#! /usr/bin/env node

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
                setTimeout(() => this.stop().then(devices => resolve(devices)), timeout);
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

            setTimeout(() => {
                if (!didResolve) {
                    resolve(null)
                }
            }, timeout)
        })
    }

    public stop(): Promise<TibboDevice[]> {
        return Promise.all(this.activeSockets.map(socket => socket.close()))
            .then(() => Object.values(this.devices))
    }

    public login(ipAddress: string, password: string, key: string = this.key): Promise<TibboDeviceLoginResponse> {
        const socket = DgramAsPromised.createSocket("udp4");
        const message = TibboHelpers.loginMessage(password, key);
        const encodedMessage = Buffer.from(message);

        return new Promise<TibboDeviceLoginResponse>((resolve) => {
            let didResolve = false;

            socket.bind().then(() => {
                this.activeSockets.push(socket);

                socket.setBroadcast(true);
                socket.setMulticastTTL(128);

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
                    resolve(response);
                });

            setTimeout(() => {
                if (!didResolve) {
                    socket.close().then(() => {
                        resolve({key, success: false, message: 'ERR_TIMEOUT'});
                    }).catch(() => {
                        resolve({key, success: false, message: 'ERR_TIMEOUT'});
                    })
                }
            }, 3000);
        })
    }

    public buzz(ipAddress: string) {
        const socket = DgramAsPromised.createSocket("udp4");
        const encodedMessage = Buffer.from(TibboHelpers.buzzMessage);

        return this.handleSendDisconnect(socket, encodedMessage, ipAddress);
    }

    public reboot(ipAddress: string) {
        const socket = DgramAsPromised.createSocket("udp4");
        const encodedMessage = Buffer.from(TibboHelpers.rebootMessage);

        return this.handleSendDisconnect(socket, encodedMessage, ipAddress);
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
            socket.setMulticastTTL(128);

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
            socket.setMulticastTTL(128);

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

    private handleSendDisconnect(socket: SocketAsPromised, encodedMessage: Buffer, ipAddress: string) {
        return socket.bind().then(() => {
            this.activeSockets.push(socket);

            socket.setBroadcast(true);
            socket.setMulticastTTL(128);

            return socket.send(encodedMessage, 0, encodedMessage.length, BROADCAST_PORT, ipAddress);
        }).then(() => socket.close()).then(() => true);
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

        promise = instance.buzz(ipAddress);
    } else if (process.argv[2] === 'reboot') {
        const ipAddress: string = process.argv[3];

        promise = instance.reboot(ipAddress);
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
