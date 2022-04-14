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

    public scan(timeout: number = 5000): Promise<TibboDevice[]> {
        return this.sendBroadcastMessage(TibboHelpers.discoverMessage).then(() => {
            return new Promise(resolve => {
                setTimeout(() => this.stop().then(devices => resolve(devices)), timeout);
            })
        })
    }

    public query(id: string): Promise<TibboDevice | null> {
        return this.sendBroadcastMessage(TibboHelpers.queryMessage(id))
            .then(socket => socket.recv())
            .then(packet => TibboHelpers.processQueryResponse(id, packet))
    }

    public stop(): Promise<TibboDevice[]> {
        return Promise.all(this.activeSockets.map(socket => socket.close()))
            .then(() => Object.values(this.devices))
    }

    public login(ipAddress: string, password: string): Promise<TibboDeviceLoginResponse> {
        const socket = DgramAsPromised.createSocket("udp4");
        const key = 'apple123';
        const message = `L${password}|${key}`;
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

    public async updateSetting(setting: string,
                               value: string,
                               ipAddress: string,
                               password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse> {
        const didAuth = await this.login(ipAddress, password);

        if (!didAuth.success) {
            return didAuth;
        }

        const socket = DgramAsPromised.createSocket("udp4");
        const message = `S${setting}@${value}|${didAuth.key}`;
        const encodedMessage = Buffer.from(message);

        return socket.bind().then(() => {
            this.activeSockets.push(socket);

            socket.setBroadcast(true);
            socket.setMulticastTTL(128);

            return socket.send(encodedMessage, 0, encodedMessage.length, BROADCAST_PORT, ipAddress);
        }).then(() => socket.recv())
            .then(packet => TibboHelpers.processSettingResponse(packet))
            .then(response => socket.close().then(() => response))
            .then(response => ({
                success: (response || false),
                key: didAuth.key
            }))
    }

    public async updateSettings(settings: TibboDeviceSetting[],
                                ipAddress: string,
                                password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse> {
        const didAuth = await this.login(ipAddress, password);

        if (!didAuth.success) {
            return didAuth;
        }

        const socket = DgramAsPromised.createSocket("udp4");
        const settingMessages = settings.map(setting => `S${setting.settingName}@${setting.settingValue}|${didAuth.key}`)
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

}

/* istanbul ignore if */
if (require.main == module) {
    const instance = new TibboDiscover();


    if (process.argv[2] === 'login') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];

        instance.login(ipAddress, password).then(result => console.log(result));
    } else if (process.argv[2] === 'setting') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];
        const setting: string = process.argv[5];
        const value: string = process.argv[6];

        instance.updateSetting(setting, value, ipAddress, password).then(result => console.log(result));
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


        instance.updateSettings(settings, ipAddress, password).then(result => console.log(result));
    } else {
        instance.scan().then(result => console.log(result));
    }
}
