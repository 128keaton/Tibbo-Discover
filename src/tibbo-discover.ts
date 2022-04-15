#! /usr/bin/env node
import {setTimeout} from 'timers/promises';
import DgramAsPromised, {SocketAsPromised} from "dgram-as-promised";
import {Buffer} from "buffer";
import {TibboHelpers} from "./tibbo-helpers";
import {
    TibboDevice,
    TibboDeviceLoginResponse,
    TibboDeviceSetting,
    TibboDeviceUpdateSettingResponse
} from "./tibbo-types";

const BROADCAST_PORT = 65535;
const BROADCAST_ADDR = '255.255.255.255';

export class TibboDiscover {

    private devices: { [key: string]: TibboDevice } = {};
    private activeSockets: SocketAsPromised[] = [];
    private readonly key: string = 'tibbo123';

    constructor(key?: string) {
        if (!!key && key.length) {
            this.key = key;
        }
    }

    public scan(timeout: number = 5000): Promise<TibboDevice[]> {
        return this.sendBroadcastMessage(TibboHelpers.discoverMessage).then(() => {
            return new Promise(resolve => {
                setTimeout(timeout).then(() => {
                    this.stop().then(devices => resolve(devices))
                })
            })
        })
    }

    public query(id: string, timeout: number = 1500): Promise<TibboDevice | null> {
        return new Promise<TibboDevice | null>(resolve => {
            let didResolve = false;

            this.sendBroadcastMessage(TibboHelpers.queryMessage(id))
                .then(socket => socket.recv())
                .then(packet => TibboHelpers.processQueryResponse(id, packet))
                .then(result => {
                    didResolve = true;
                    resolve(result)
                });

            setTimeout(timeout).then(() => {
                if (!didResolve) {
                    resolve(null)
                }
            })
        })
    }

    public stop(): Promise<TibboDevice[]> {
        const finished = () => {
            this.activeSockets.forEach(socket => socket.unref());
            this.activeSockets = [];
            return Object.values(this.devices)
        }

        return Promise.all(this.activeSockets.map(socket => socket.close()))
            .then(() => finished())
            .catch(() => finished());
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

                return socket.send(encodedMessage, 0, encodedMessage.length, BROADCAST_PORT, ipAddress);
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

            return Promise.all(settingMessages.map(setting => TibboHelpers.iterateSend(socket, setting, ipAddress, BROADCAST_PORT)))
        }).then((results: boolean[]) => {
            return results.map((result, index) => ({
                success: result,
                setting: settings[index]
            }))
        }).then(results => socket.close().then(() => results));
    }

    private sendBroadcastMessage(message: string) {
        const socket = DgramAsPromised.createSocket("udp4");
        const encodedMessage = Buffer.from(message);

        return socket.bind().then(() => {
            this.activeSockets.push(socket);

            socket.setBroadcast(true);

            socket.socket.on('message', (msg) => {
                const tibboID = TibboHelpers.getMacAddress(msg);

                if (!!tibboID && !this.devices[tibboID]) {
                    return this.query(tibboID).then(result => {
                        if (!!result)
                            this.devices[tibboID] = result;
                    })
                }
            });

            return socket.send(encodedMessage, 0, encodedMessage.length, BROADCAST_PORT, BROADCAST_ADDR);
        }).then(() => socket);
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

                        return socket.send(encodedMessage, 0, encodedMessage.length, BROADCAST_PORT, ipAddress);
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

/* istanbul ignore if */
if (require.main == module) {
    const instance = new TibboDiscover();
    let promise: Promise<any>;

    if (process.argv[2] === 'login') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];

        promise = instance.login(ipAddress, password);
    } else if (process.argv[2] === 'setting') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];
        const setting: string = process.argv[5];
        const value: string = process.argv[6];

        promise = instance.updateSetting(setting, value, ipAddress, password);
    } else if (process.argv[2] === 'settings') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];
        const rawSettings: string[] = process.argv[5].split(',');
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


        promise = instance.updateSettings(settings, ipAddress, password);
    } else if (process.argv[2] === 'buzz') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];
        const key: string | undefined = process.argv[5];

        promise = instance.buzz(ipAddress, password, key);
    } else if (process.argv[2] === 'reboot') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];
        const key: string | undefined = process.argv[5];

        promise = instance.reboot(ipAddress, password, key);
    } else if (process.argv[2] === 'query') {
        const id: string = process.argv[3];

        let timeout: undefined | number = Number(process.argv[4]);

        if (isNaN(timeout)) {
            timeout = undefined;
        }

        promise = instance.query(id, timeout).then(result => instance.stop().then(() => result));
    } else {
        let timeout: undefined | number = Number(process.argv[2]);

        if (isNaN(timeout)) {
            timeout = undefined;
        }

        promise = instance.scan(timeout);
    }

    promise.then(result => console.log(JSON.stringify(result, null, 2)));
}
