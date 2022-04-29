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
    private _debug: boolean = false;
    private readonly key: string = 'tibbo123';

    get debug(): boolean {
        return this._debug;
    }

    set debug(debug: boolean) {
        this.debugPrint('info', 'Enabling debug printing...');
        this._debug = debug;
    }

    constructor(debug: boolean = false, key?: string) {
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

        TibboHelpers.debugPrint('info', 'Logging into Tibbo at', ipAddress, 'with key', key, 'and password', TibboHelpers.hidePassword(password), 'with timeout', timeout);
        TibboHelpers.debugPrint('info', 'Raw login message:', message);

        return new Promise<TibboDeviceLoginResponse>((resolve) => {
            let didResolve = false;
            let message: string | undefined;

            this.setupLoginTimeout(resolve, key, signal, socket, timeout);

            socket.bind()
                .then(() => this.appendSocket(socket, true))
                .then(socket => socket.send(encodedMessage, 0, encodedMessage.length, TIBBO_BROADCAST_PORT, ipAddress))
                .then(() => socket.recv())
                .then(packet => {
                    if (!!packet) {
                        message = packet.msg.toString();
                    }

                    return TibboHelpers.processLoginResponse(packet);
                })
                .then(response => socket.close().catch(() => response).then(() => response))
                .then(response => ({
                    success: (response || false),
                    key,
                    message
                }))
                .then(response => {
                    didResolve = true;
                    abortController.abort();
                    resolve(response);
                });


        })
    }

    public buzz(ipAddress: string, password: string, key: string = this.key) {
        TibboHelpers.debugPrint('info', 'Buzzing Tibbo at', ipAddress, 'with key', key, 'and password', TibboHelpers.hidePassword(password));
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.buzzMessage(key));
    }

    public reboot(ipAddress: string, password: string, key: string = this.key) {
        TibboHelpers.debugPrint('info', 'Rebooting Tibbo at', ipAddress, 'with key', key, 'and password', TibboHelpers.hidePassword(password));
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.rebootMessage(key), true);
    }

    public raw(ipAddress: string, password: string, message: string, key: string = this.key) {
        TibboHelpers.debugPrint('info', 'Running raw command on Tibbo at', ipAddress, 'with key', key, 'and password', TibboHelpers.hidePassword(password), 'with command:', message);
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.rawMessage(message, key));
    }

    public readSetting(ipAddress: string, password: string, setting: string, key: string = this.key): Promise<string | null> {
        TibboHelpers.debugPrint('info', 'Reading setting named', setting, 'on Tibbo at', ipAddress, 'with key', key, 'and password', TibboHelpers.hidePassword(password));
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.getSettingMessage(setting, key), false, 10000)
            .then(response => TibboHelpers.stripSettingsResponse(key, response))
    }

    public initializeSettings(ipAddress: string, password: string, key: string = this.key) {
        TibboHelpers.debugPrint('info', 'Initializing settings on Tibbo at', ipAddress, 'with key', key, 'and password', TibboHelpers.hidePassword(password));
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.initializeSettingsMessage(key));
    }

    public async updateSetting(setting: string,
                               value: string,
                               ipAddress: string,
                               password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse> {
        TibboHelpers.debugPrint('info', 'Updating setting named', setting, 'with value', value, 'on Tibbo at', ipAddress, 'and password', TibboHelpers.hidePassword(password));
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

        TibboHelpers.debugPrint('info', 'Updating settings named on Tibbo at', ipAddress, 'and password', TibboHelpers.hidePassword(password), 'with values', settings);

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
            }).then(results => socket.close().then(() => this.logout(ipAddress, password, didAuth.key)).then(() => results));
    }

    public stop(): Promise<void> {
        if (this.activeSockets.length === 0) {
            return new Promise(resolve => resolve())
        }

        TibboHelpers.debugPrint('warning', 'Stop called on TibboDeviceServer instance');

        const finished = () => {
            this.activeSockets.forEach(socket => socket.unref());
            this.activeSockets = [];
            return;
        }

        return Promise.all(this.activeSockets.map(socket => socket.close()))
            .then(() => finished())
            .catch((err) => {
                TibboHelpers.debugPrint('error', 'Error caught on closing sockets:', err);
                return finished();
            });
    }

    private logout(ipAddress: string, password: string, key: string = this.key) {
        TibboHelpers.debugPrint('info', 'Logging out of Tibbo at', ipAddress, 'with key', key, 'and password', TibboHelpers.hidePassword(password));
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.logoutMessage(key), true);
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
            TibboHelpers.debugPrint('success', 'Processing login response', result.message, 'responding with', encodedMessage.toString('utf8'));

            return socket.bind()
                .then(() => this.appendSocket(socket))
                .then(socket => socket.send(encodedMessage, 0, encodedMessage.length, TIBBO_BROADCAST_PORT, ipAddress))
                .catch(() => resolver({message: 'Could not send message'}))
        } else {
            TibboDeviceServer.handleDenied(resolver, result.message);
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
            .catch((err) => {
                let errorCode: string = 'ERR_TIMEOUT';

                if (!!err && err.hasOwnProperty('code')) {
                    errorCode = err['code'];
                }

                resolver({key, message: errorCode, success: false})
            });
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

        TibboHelpers.debugPrint('info',
            'Sending single authenticated message to IP',
            ipAddress,
            'with password',
            TibboHelpers.hidePassword(password),
            'and key',
            key,
            'with message contents:',
            message
        );

        return new Promise(resolve => {
            this.setupTimeout(resolve, signal, socket, timeout, expectTimeout);

            this.login(ipAddress, password, key, timeout)
                .then(result => this.handleLoginResponse(result, encodedMessage, ipAddress, socket, resolve))
                .then(() => socket.recv())
                .then(packet => TibboDeviceServer.handleGenericPacket(abortController, packet))
                .then(response => {
                    if (message !== TibboHelpers.logoutMessage(key) && response.data !== undefined) {
                        return this.logout(ipAddress, password, key).then(() => response);
                    }

                    return response;
                })
                .then(response => this.stop().then(() => resolve(response)))
        });
    }

    private debugPrint(color: 'success' | 'info' | 'error' | 'warning' | 'none' = 'none', ...data: any[]) {
        if (this.debug) {
            TibboHelpers.debugPrint(color, data);
        }
    }

    private static handleGenericPacket(abortController: AbortController, packet?: IncomingPacket) {
        const denied = TibboHelpers.checkIfDenied(packet);
        let data = undefined;
        abortController.abort();

        if (denied) {
            TibboHelpers.debugPrint('error', 'Access denied from handleGenericPacket');
            return {message: 'ACCESS_DENIED'};
        }

        if (packet) {
            data = packet.msg.toString();
            TibboHelpers.debugPrint('success', 'Data from handleGenericPacket:', data);
        }

        return {message: 'SUCCESS', data};
    }

    private static handleDenied(resolver: (value: { message: string, success: boolean }) => void, message?: string) {
        TibboHelpers.debugPrint('error', 'Access denied from handleDenied');
        resolver({message: (!!message ? message : 'ACCESS_DENIED'), success: false});
    }
}

/* istanbul ignore if */
if (require.main == module) {
    const tibboDeviceServer = new TibboDeviceServer();

    program
        .name('tibbo-device-server')
        .description('CLI to modify DS-Tibbo devices on the network')
        .version(PACKAGE_VERSION)
        .option('-d, --debug', 'output extra debugging');

    program
        .command('login')
        .description('Login to a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .action((ipAddress, password) => {
            tibboDeviceServer.debug = program.opts()['debug'];
            tibboDeviceServer.login(ipAddress, password)
                .then(result => tibboDeviceServer.stop().then(() => result))
                .then(result => console.log(JSON.stringify(result, null, 2)))
        });

    program
        .command('buzz')
        .description('Buzz a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to buzz')
        .argument('<password>', 'Password of the Tibbo device to buzz')
        .action((ipAddress, password) => {
            tibboDeviceServer.debug = program.opts()['debug'];
            tibboDeviceServer.buzz(ipAddress, password)
                .then(result => tibboDeviceServer.stop().then(() => result))
                .then(result => console.log(JSON.stringify(result, null, 2)))
        });

    program
        .command('reboot')
        .description('Reboot a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to reboot')
        .argument('<password>', 'Password of the Tibbo device to reboot')
        .action((ipAddress, password) => {
            tibboDeviceServer.debug = program.opts()['debug'];
            tibboDeviceServer.reboot(ipAddress, password)
                .then(result => tibboDeviceServer.stop().then(() => result))
                .then(result => console.log(JSON.stringify(result, null, 2)))
        });

    program
        .command('raw')
        .description('Send a raw command to a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to send the raw command rto')
        .argument('<password>', 'Password of the Tibbo device to send the raw command to')
        .argument('<raw>', 'The raw command')
        .action((ipAddress, password, raw) => {
            tibboDeviceServer.debug = program.opts()['debug'];
            tibboDeviceServer.raw(ipAddress, password, raw)
                .then(result => tibboDeviceServer.stop().then(() => result))
                .then(result => console.log(JSON.stringify(result, null, 2)))
        });

    const setting = program.command('setting');

    setting.command('set')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<setting>', 'Setting name on the Tibbo device')
        .argument('<value>', 'New value of the setting')
        .action((ipAddress, password, setting, value) => {
            tibboDeviceServer.debug = program.opts()['debug'];
            tibboDeviceServer.updateSetting(setting, value, ipAddress, password)
                .then(result => tibboDeviceServer.stop().then(() => result))
                .then(result => console.log(JSON.stringify(result, null, 2)))
        });

    setting.command('get')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<setting>', 'Setting name on the Tibbo device')
        .action((ipAddress, password, setting) => {
            tibboDeviceServer.debug = program.opts()['debug'];
            tibboDeviceServer.readSetting(ipAddress, password, setting)
                .then(result => tibboDeviceServer.stop().then(() => {
                    const object: any = {};
                    object[setting] = result;

                    return object
                }))
                .then(result => console.log(JSON.stringify(result, null, 2)))
        });

    setting.command('set-multiple')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<settings>', 'Comma-separated values to set')
        .action((ipAddress, password, csv) => {
            tibboDeviceServer.debug = program.opts()['debug'];
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

