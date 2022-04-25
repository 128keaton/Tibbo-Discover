import {
    TibboDeviceLoginResponse,
    TibboDeviceSetting,
    TibboDeviceUpdateSettingResponse
} from "./tibbo-types";
import DgramAsPromised, {SocketAsPromised} from "dgram-as-promised";
import {TibboHelpers} from "./tibbo-helpers";
import {Buffer} from "buffer";
import {setTimeout} from "timers/promises";
import {TIBBO_BROADCAST_PORT} from "./tibbo-shared";

export class TibboDeviceServer {
    private activeSockets: SocketAsPromised[] = [];
    private readonly key: string = 'tibbo123';

    constructor(key?: string) {
        if (!!key && key.length) {
            this.key = key;
        }
    }

    public login(ipAddress: string, password: string, key: string = this.key): Promise<TibboDeviceLoginResponse> {
        const socket = DgramAsPromised.createSocket("udp4");
        const message = TibboHelpers.loginMessage(password, key);
        const encodedMessage = Buffer.from(message);
        const ac = new AbortController();
        const signal = ac.signal;

        return new Promise<TibboDeviceLoginResponse>((resolve) => {
            let didResolve = false;

            setTimeout(3000, 'timeout', {signal}).then(() => {
                if (!didResolve) {
                    this.stop().then(() => {
                        resolve({key, success: false, message: 'ERR_TIMEOUT'});
                    }).catch(() => {
                        resolve({key, success: false, message: 'ERR_TIMEOUT'});
                    })
                }
            }).catch(() => resolve({key, success: false, message: 'ERR_TIMEOUT'}))

            socket.bind().then(() => {
                this.activeSockets.push(socket);

                socket.setBroadcast(true);

                return socket.send(encodedMessage, 0, encodedMessage.length, TIBBO_BROADCAST_PORT, ipAddress);
            }).then(() => socket.recv())
                .then(packet => TibboHelpers.processLoginResponse(packet))
                .then(response => {
                    return socket.close()
                        .catch(() => response)
                        .then(() => response)
                })
                .then(response => ({
                    success: (response || false),
                    key,
                }))
                .then(response => {
                    didResolve = true;
                    ac.abort();
                    resolve(response);
                });


        })
    }

    public buzz(ipAddress: string, password: string, key: string = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.buzzMessage(key));
    }

    public reboot(ipAddress: string, password: string, key: string = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, TibboHelpers.rebootMessage(key));
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

        return socket.bind().then(() => {
            this.activeSockets.push(socket);

            socket.setBroadcast(true);

            return Promise.all(settingMessages.map(setting => TibboHelpers.iterateSend(socket, setting, ipAddress, TIBBO_BROADCAST_PORT)))
        }).then((results: boolean[]) => {
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

    private sendSingleAuthMessage(ipAddress: string, password: string, key: string, message: string) {
        const socket = DgramAsPromised.createSocket("udp4");
        const encodedMessage = Buffer.from(message);

        const ac = new AbortController();
        const signal = ac.signal;

        return new Promise(resolve => {
            setTimeout(1000, 'timeout', {signal}).then(() => {
                Promise.all([this.stop(), socket.close()])
                    .catch(() => resolve({message: 'Success'}))
                    .then(() => resolve({message: 'Success'}))
            }).catch(() => resolve({message: 'Success'}))

            this.login(ipAddress, password, key).then(result => {
                if (!result.success) {
                    resolve({message: 'Access denied'});
                } else {
                    return socket.bind().then(() => {
                        this.activeSockets.push(socket);

                        socket.setBroadcast(true);

                        return socket.send(encodedMessage, 0, encodedMessage.length, TIBBO_BROADCAST_PORT, ipAddress);
                    }).catch(() => resolve(false))
                }
            }).then(() => socket.recv()).then(packet => {
                const denied = TibboHelpers.checkIfDenied(packet);
                ac.abort();

                if (denied) {
                    return {message: 'Access denied'};
                }

                return {message: 'Success'};

            }).then(response => this.stop().then(() => response))
        });
    }
}
