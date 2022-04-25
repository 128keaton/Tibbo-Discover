import {
    TibboDeviceLoginResponse,
    TibboDeviceSetting,
    TibboDeviceUpdateSettingResponse
} from "./tibbo-types";
import DgramAsPromised, {IncomingPacket, SocketAsPromised} from "dgram-as-promised";
import {TibboHelpers} from "./tibbo-helpers";
import {Buffer} from "buffer";
import {setTimeout} from "timers/promises";
import {PACKAGE_VERSION, TIBBO_BROADCAST_PORT} from "./tibbo-shared";
import {program} from "commander";

export class TibboDeviceServer {
    private activeSockets: SocketAsPromised[] = [];
    private readonly key: string = 'tibbo123';

    constructor(key?: string) {
        if (!!key && key.length) {
            this.key = key;
        }
    }

    public login(ipAddress: string, password: string, key: string = this.key, timeout: number = 3000): Promise<TibboDeviceLoginResponse> {
        const socket = DgramAsPromised.createSocket("udp4");
        const message = TibboHelpers.loginMessage(password, key);
        const encodedMessage = Buffer.from(message);
        const abortController = new AbortController();
        const signal = abortController.signal;

        return new Promise<TibboDeviceLoginResponse>((resolve) => {
            let didResolve = false;

            this.setupLoginTimeout(resolve, key, signal, socket, timeout);

            socket.bind()
                .then(() => this.appendSocket(socket, true))
                .then(socket => socket.send(encodedMessage, 0, encodedMessage.length, TIBBO_BROADCAST_PORT, ipAddress))
                .then(() => socket.recv())
                .then(packet => TibboHelpers.processLoginResponse(packet))
                .then(response => socket.close().catch(() => response).then(() => response))
                .then(response => ({
                    success: (response || false),
                    key,
                }))
                .then(response => {
                    didResolve = true;
                    abortController.abort();
                    resolve(response);
                });


        })
    }

    public buzz(ipAddress: string, password: string, key: string = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.buzzMessage(key));
    }

    public reboot(ipAddress: string, password: string, key: string = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.rebootMessage(key), true);
    }

    public raw(ipAddress: string, password: string, message: string, key: string = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.rawMessage(message, key));
    }

    public readSetting(ipAddress: string, password: string, setting: string, key: string = this.key): Promise<string|null> {
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.getSettingMessage(setting, key), false, 10000)
            .then(response => TibboHelpers.stripSettingsResponse(key, response))
    }

    public initializeSettings(ipAddress: string, password: string, key: string = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.initializeSettingsMessage(key));
    }

    public async updateSetting(setting: string,
                               value: string,
                               ipAddress: string,
                               password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse> {
        const settings = [
            {
                settingValue: value,
                settingName: setting
            }
        ];

        return this.updateSettings(
            settings,
            ipAddress,
            password
        );
    }

    public async updateSettings(settings: TibboDeviceSetting[],
                                ipAddress: string,
                                password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse> {
        const didAuth = await this.login(ipAddress, password);

        if (!didAuth.success) {
            return didAuth;
        }

        const socket = DgramAsPromised.createSocket("udp4");
        const settingMessages = settings.map(setting => TibboHelpers.updateSettingMessage(setting.settingName, setting.settingValue, didAuth.key))
            .map(string => Buffer.from(string));

        return socket.bind()
            .then(() => this.appendSocket(socket, true))
            .then(socket => Promise.all(settingMessages.map(setting => TibboHelpers.iterateSend(socket, setting, ipAddress, TIBBO_BROADCAST_PORT))))
            .then((results: boolean[]) => {
                return results.map((result, index) => ({
                    success: result,
                    setting: settings[index]
                }))
            }).then(results => socket.close().then(() => results));
    }

    public stop(): Promise<void> {
        const finished = () => {
            this.activeSockets.forEach(socket => socket.unref());
            this.activeSockets = [];
            return;
        }

        return Promise.all(this.activeSockets.map(socket => socket.close()))
            .then(() => finished())
            .catch(() => finished());
    }


    private static handleTimeout(expectTimeout: boolean, resolver: (value: { message: string }) => void) {
        if (expectTimeout) {
            resolver({message: 'SUCCESS'})
        } else {
            resolver({message: 'ERR_TIMEOUT'})
        }
    }

    private appendSocket(socket: SocketAsPromised, broadcast: boolean = false): SocketAsPromised {
        if (broadcast) {
            socket.setBroadcast(true);
        }

        this.activeSockets.push(socket);
        return socket;
    }

    private handleLoginResponse(result: TibboDeviceLoginResponse,
                                encodedMessage: Buffer,
                                ipAddress: string,
                                socket: SocketAsPromised, resolver: (value: { message: string }) => void) {
        if (result.success) {
            return socket.bind()
                .then(() => this.appendSocket(socket))
                .then(socket => socket.send(encodedMessage, 0, encodedMessage.length, TIBBO_BROADCAST_PORT, ipAddress))
                .catch(() => resolver({message: 'Could not send message'}))
        } else {
            TibboDeviceServer.handleDenied(resolver);
        }
    }

    private setupLoginTimeout(resolver: (value: TibboDeviceLoginResponse) => void,
                              key: string,
                              signal: AbortSignal,
                              socket: SocketAsPromised,
                              timeout: number = 2000) {

        setTimeout(timeout, 'timeout', {signal})
            .then(() => Promise.all([this.stop(), socket.close()])
                .then(() => resolver({key, message: 'ERR_TIMEOUT', success: false})))
            .catch(() => resolver({key, message: 'ERR_TIMEOUT', success: false}));
    }

    private setupTimeout(resolver: (value: { message: string } | TibboDeviceLoginResponse) => void,
                         signal: AbortSignal,
                         socket: SocketAsPromised,
                         timeout: number = 2000,
                         expectTimeout: boolean = false) {

        setTimeout(timeout, 'timeout', {signal})
            .then(() => Promise.all([this.stop(), socket.close()])
                .then(() => TibboDeviceServer.handleTimeout(expectTimeout, resolver)))
            .catch(() => {
            });
    }

    private sendSingleAuthMessage(ipAddress: string,
                                  password: string,
                                  key: string,
                                  message: string,
                                  expectTimeout: boolean = false,
                                  timeout: number = 2000): Promise<{ message?: any, data?: any }> {
        const socket = DgramAsPromised.createSocket("udp4");
        const encodedMessage = Buffer.from(message);

        const abortController = new AbortController();
        const signal = abortController.signal;


        return new Promise(resolve => {
            this.setupTimeout(resolve, signal, socket, timeout, expectTimeout);

            this.login(ipAddress, password, key, timeout)
                .then(result => this.handleLoginResponse(result, encodedMessage, ipAddress, socket, resolve))
                .then(() => socket.recv())
                .then(packet => TibboDeviceServer.handleGenericPacket(abortController, packet))
                .then(response => this.stop().then(() => resolve(response)))
        });
    }

    private static handleGenericPacket(abortController: AbortController, packet?: IncomingPacket) {
        const denied = TibboHelpers.checkIfDenied(packet);
        abortController.abort();

        if (denied) {
            return {message: 'ACCESS_DENIED'};
        }


        if (packet) {
            return {message: 'Success', data: packet.msg.toString()};
        }

        return {message: 'SUCCESS'};
    }

    private static handleDenied(resolver: (value: { message: string }) => void) {
        resolver({message: 'ACCESS_DENIED'});
    }
}

/* istanbul ignore if */
if (require.main == module) {
    const tibboDeviceServer = new TibboDeviceServer();

    program
        .name('tibbo-device-server')
        .description('CLI to modify DS-Tibbo devices on the network')
        .version(PACKAGE_VERSION);

    program
        .command('login')
        .description('Login to a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .action((ipAddress, password) => tibboDeviceServer.login(ipAddress, password)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2))));

    program
        .command('buzz')
        .description('Buzz a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to buzz')
        .argument('<password>', 'Password of the Tibbo device to buzz')
        .action((ipAddress, password) => tibboDeviceServer.buzz(ipAddress, password)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2))));

    program
        .command('reboot')
        .description('Reboot a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to reboot')
        .argument('<password>', 'Password of the Tibbo device to reboot')
        .action((ipAddress, password) => tibboDeviceServer.reboot(ipAddress, password)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2))));

    program
        .command('raw')
        .description('Send a raw command to a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to send the raw command rto')
        .argument('<password>', 'Password of the Tibbo device to send the raw command to')
        .argument('<raw>', 'The raw command')
        .action((ipAddress, password, raw) => tibboDeviceServer.raw(ipAddress, password, raw)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2))));

    const setting = program.command('setting');

    setting.command('set')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<setting>', 'Setting name on the Tibbo device')
        .argument('<value>', 'New value of the setting')
        .action((ipAddress, password, setting, value) => tibboDeviceServer.updateSetting(setting, value, ipAddress, password)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2))));

    setting.command('get')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<setting>', 'Setting name on the Tibbo device')
        .action((ipAddress, password, setting) => tibboDeviceServer.readSetting(ipAddress, password, setting)
            .then(result => tibboDeviceServer.stop().then(() => {
                const object: any = {};
                object[setting] = result;

                return object
            }))
            .then(result => console.log(JSON.stringify(result, null, 2))));

    setting.command('set-multiple')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<settings>', 'Comma-separated values to set')
        .action((ipAddress, password, csv) => {
            const rawSettings: string[] = csv.split(',');
            const settings: TibboDeviceSetting[] = [];

            let currentSetting: string;
            rawSettings.forEach((value, index) => {
                if (index % 2 === 0) {
                    currentSetting = value;
                } else {
                    settings.push({
                        settingName: currentSetting,
                        settingValue: value
                    })
                }
            });


            return tibboDeviceServer.updateSettings(settings, ipAddress, password)
                .then(result => tibboDeviceServer.stop().then(() => result))
                .then(result => console.log(JSON.stringify(result, null, 2)));
        });

    program.parse();
}

