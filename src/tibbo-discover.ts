#! /usr/bin/env node

import {createSocket, Socket} from "dgram";
import {BehaviorSubject, filter, firstValueFrom, Observable} from "rxjs";

const IP = require("ip");
const MAC_REGEX = /\[\d..\.\d..\.\d..\.\d..\.\d..\.\d..][CRA]/;
const EMPTY_RESPONSE_LENGTH = 26;
const BROADCAST_PORT = 65535;

export interface TibboDevice {
    boardType: string;
    currentApp: string;
    data: any;
    address: string;
    id: string;
    macAddress: string;
}


export class TibboDiscover {

    public get devices(): Observable<TibboDevice[]> {
        return this.$devices.asObservable().pipe(
            filter(Boolean)
        );
    }

    private $devices: BehaviorSubject<TibboDevice[] | null> = new BehaviorSubject<TibboDevice[] | null>(null);
    private _broadcastAddress = '255.255.255.255';
    private _isBound = false;
    private _scanTimeout: number = 5000;
    private _devices: { [key: string]: TibboDevice } = {};
    private _currentClient?: Socket;

    constructor(private defaultTimeout: number = 5000) {
        this._scanTimeout = defaultTimeout;
        this._currentClient = createSocket('udp4');

        const hostAddress: string[] = `${IP.address()}`.split('.');

        hostAddress[3] = '255';

        this._broadcastAddress = hostAddress.join('.');
    }

    public scan(timeout = 5000) {
        this._scanTimeout = timeout;
        this.setupClient(this._currentClient)?.then(() => {
            this.sendDiscoverMessage();

            if (timeout > 0) {
                setTimeout(() => {
                    this.stop();
                }, this._scanTimeout);
            }
        });
    }

    public stop() {
        const client = this._currentClient;

        if (!client) {
            throw new Error('dgram client not available');
        }

        client.close(() => {
            this._currentClient = createSocket('udp4');
        });

        if (this.$devices.value === null) {
            this.$devices.next([]);
        }

        this.$devices.complete();
        this._isBound = false;
    }

    public async reboot(ipAddress: string) {
        this.scan();

        return firstValueFrom(this.devices).then(devices => {
            const device = (devices || [])?.find(d => d.address === ipAddress);

            if (!device) {
                throw new Error('Could not find device');
            }

            this.send(`_${device.id}E`);
        })
    }

    private send(message: string) {
        const client = this._currentClient;

        if (!client) {
            throw new Error('dgram client not available');
        }

        client.send(Buffer.from(message), BROADCAST_PORT, this._broadcastAddress);
    }

    private sendDiscoverMessage() {
        this.send("_?");
    }

    private sendQueryMessage(forClient: string) {
        return this.send(TibboDiscover.buildQueryMessage(forClient));
    }

    private processMessage(message: string, info: any) {
        const address = message.match(MAC_REGEX)![0];
        const segment = `${address}`.replace(/\[|][CRA]/g, '');
        const macAddress = segment.split('.').map(r => Number(r)).join(':');

        if (message.length === EMPTY_RESPONSE_LENGTH) {
            this.sendQueryMessage(segment);
        } else {
            const deviceInfo = TibboDiscover.parseDeviceInfo(message, address, macAddress, info);

            if (!this._devices.hasOwnProperty(deviceInfo.id)) {
                this._devices[deviceInfo.id] = deviceInfo;
                this.emitUpdate();
            }
        }
    }

    private emitUpdate() {
        const newDevices = Object.values(this._devices);

        if (!!newDevices && newDevices.length > 0) {
            this.$devices.next(newDevices);
        }
    }

    private setupClient(client?: Socket) {
        return new Promise((resolve, reject) => {
            if (this._isBound) {
                resolve(true);
                return;
            }

            if (!client) {
                reject('dgram client not available');
                return;
            }

            client.on('message', (buffer: Buffer, info: { address: string }) => {
                const message = buffer.toString();
                if (!!message) {
                    const matches = message.match(MAC_REGEX);

                    if (!!matches) {
                        this.processMessage(message, info);
                    }
                }
            });

            client.once('listening', () => {
                this._isBound = true;

                client.setBroadcast(true);
                resolve(true);
            });

            client.bind();
        })
    }

    private static parseDeviceInfo(message: string,
                                   rawAddress: string,
                                   macAddress: string,
                                   info: { address: string }): TibboDevice {
        const [boardType, data, currentApp] = message.replace(rawAddress, '').split('/');

        return {
            boardType: boardType.replace(/[<>]/g, ''),
            data,
            currentApp,
            address: info.address,
            id: rawAddress.slice(0, rawAddress.length - 1),
            macAddress
        }
    }


    private static buildQueryMessage(client: string): string {
        return `_[${client}]X|`;
    }
}

/* istanbul ignore if */
if (require.main == module) {
    const instance = new TibboDiscover();

    if (process.argv[2] === 'reboot') {
        const target: string = process.argv[3];

        if (!target) {
            throw new Error('No target specified');
        }

        instance.reboot(target).then(() => {
            console.log(target, 'rebooted');
        })

    } else {
        let timeout: number | undefined = Number(process.argv[2]);

        if (isNaN(timeout) || !timeout) {
            timeout = undefined;
        }

        instance.scan(timeout);
        instance.devices.subscribe(devices => {
            console.log(JSON.stringify({devices}))
        });
    }
}
