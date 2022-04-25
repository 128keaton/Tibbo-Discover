#! /usr/bin/env node
import {setTimeout} from 'timers/promises';
import DgramAsPromised, {SocketAsPromised} from "dgram-as-promised";
import {Buffer} from "buffer";
import {TibboHelpers} from "./tibbo-helpers";
import {
    TibboDevice,
    TibboDeviceSetting,
} from "./tibbo-types";
import {TIBBO_BROADCAST_ADDR, TIBBO_BROADCAST_PORT} from "./tibbo-shared";
import {TibboDeviceServer} from "./tibbo-device-server";

export class TibboDiscover {

    private devices: { [key: string]: TibboDevice } = {};
    private activeSockets: SocketAsPromised[] = [];

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

            return socket.send(encodedMessage, 0, encodedMessage.length, TIBBO_BROADCAST_PORT, TIBBO_BROADCAST_ADDR);
        }).then(() => socket);
    }


}

/* istanbul ignore if */
if (require.main == module) {
    const tibboDiscover = new TibboDiscover();
    const tibboDeviceServer = new TibboDeviceServer();
    let promise: Promise<any>;

    if (process.argv[2] === 'login') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];

        promise = tibboDeviceServer.login(ipAddress, password);
    } else if (process.argv[2] === 'setting') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];
        const setting: string = process.argv[5];
        const value: string = process.argv[6];

        promise = tibboDeviceServer.updateSetting(setting, value, ipAddress, password);
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


        promise = tibboDeviceServer.updateSettings(settings, ipAddress, password);
    } else if (process.argv[2] === 'buzz') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];
        const key: string | undefined = process.argv[5];

        promise = tibboDeviceServer.buzz(ipAddress, password, key);
    } else if (process.argv[2] === 'reboot') {
        const ipAddress: string = process.argv[3];
        const password: string = process.argv[4];
        const key: string | undefined = process.argv[5];

        promise = tibboDeviceServer.reboot(ipAddress, password, key);
    } else if (process.argv[2] === 'query') {
        const id: string = process.argv[3];

        let timeout: undefined | number = Number(process.argv[4]);

        if (isNaN(timeout)) {
            timeout = undefined;
        }

        promise = tibboDiscover.query(id, timeout).then(result => tibboDiscover.stop().then(() => result));
    } else {
        let timeout: undefined | number = Number(process.argv[2]);

        if (isNaN(timeout)) {
            timeout = undefined;
        }

        promise = tibboDiscover.scan(timeout);
    }

    promise.then(result => console.log(JSON.stringify(result, null, 2)));
}
