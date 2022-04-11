#! /usr/bin/env node

import {createSocket, Socket} from "dgram";

const MAC_REGEX = /\[\d..\.\d..\.\d..\.\d..\.\d..\.\d..]/;
const BROADCAST_PORT = 65535;
const MAX_SEARCH_TRIES = 2;

// Request bits
const START_BIT = '_';
const DISCOVER_BIT = '?';
const QUERY_BIT = 'X';
const DELIMIT_BIT = '|';
const REBOOT_BIT = 'E';

// Response bits
const ERR_BIT = 'C';
const REJECT_BIT = 'R';
const OK_BIT = 'A';
const FAIL_BIT = 'F';


export interface TibboDevice {
    boardType: string;
    currentApp: string;
    data: any;
    address: string;
    id: string;
    macAddress: string;
}

export interface TibboDeviceInstance {
    ip: string;
    id: string;
}

export class TibboDiscover {
    private _broadcastAddress = '255.255.255.255';
    private _isBound = false;
    private _scanTimeout: number = 3000;
    private _seen: { [key: string]: string } = {};
    private _devices: { [key: string]: any } = {};
    private _currentClient?: Socket;
    private _errors: { [key: string]: string } = {};
    private _messages: { [key: string]: string } = {};

    constructor(private defaultTimeout: number = 3000) {
        this._scanTimeout = defaultTimeout;
    }

    public scan(timeout = this._scanTimeout): Promise<TibboDevice[]> {
        this._scanTimeout = timeout;

        return this.setupClient()
            .then(() => this.sendDiscoverMessage())
            .then(() => {
                return new Promise(resolve => {

                    if (timeout <= 0) {
                        timeout = 1500;
                    }

                    setTimeout(async () => {
                        const devices = await this.stop();
                        resolve(devices);
                    }, this._scanTimeout);
                })
            })
    }

    public stop(): Promise<TibboDevice[]> {
        return new Promise(resolve => {
            this._isBound = false;

            if (this._currentClient) {
                this._currentClient.close(() => {
                    this._currentClient = undefined;
                    resolve(Object.values(this._devices));
                });
            } else {
                resolve(Object.values(this._devices));
            }
        })
    }

    public reboot(ipAddress: string) {
        return this.scanForDeviceAddress(ipAddress).then(async device => {
            await this.setupClient();
            if (!!device) {
                return this.send(TibboDiscover.buildBitMessage(REBOOT_BIT, device.id, false));
            } else {
                return `Could not find device ${ipAddress}`;
            }
        }).then(async (response) => {
            await this.stop()

            return new Promise((resolve, reject) => {
                if (response === true) {
                    resolve('Rebooted');
                } else {
                    reject(response);
                }
            })
        });
    }

    public sendMessage(ipAddress: string, message: string, delimit: boolean): Promise<string> {
        let currentDevice: TibboDeviceInstance|null;

        return this.scanForDeviceAddress(ipAddress).then(async device => {
            await this.setupClient();
            if (!!device) {
                currentDevice = device;
                return this.send(TibboDiscover.buildBitMessage(message, device.id, delimit));
            } else {
                return null
            }
        }).then(() => {
            return new Promise<string>((resolve, reject) => {
                setTimeout(() => {
                   if (!!currentDevice) {
                       const errors = this._errors[currentDevice.id];
                       const messages = this._messages[currentDevice.id];


                       this.stop().then(() => {
                           if (!!errors) {
                               reject(errors)
                           } else {
                               resolve(messages || '');
                           }
                       })
                   } else {
                       reject('Could not find device');
                   }
                }, 1000);
            })
        });
    }

    private send(message: string) {
        const client = this._currentClient;

        if (!client) {
            throw new Error('dgram client not available');
        }

        return new Promise((resolve, reject) => {
            client.send(Buffer.from(message), BROADCAST_PORT, this._broadcastAddress, (err) => {
                if (!!err) {
                    reject(err);
                } else {
                    resolve(true);
                }
            });
        })
    }

    private sendDiscoverMessage() {
        return this.send(START_BIT + DISCOVER_BIT);
    }

    private sendQueryMessage(forClient: string) {
        return this.send(TibboDiscover.buildBitMessage(QUERY_BIT, forClient));
    }

    private processMessage(message: string, info: any) {
        const rawAddress = message.match(MAC_REGEX)![0];
        const responseBit = message.charAt(rawAddress.length);

        if (!this._seen[rawAddress] && responseBit == OK_BIT) {
            this._seen[rawAddress] = info.address;
            return this.sendQueryMessage(rawAddress);
        } else if (responseBit === OK_BIT && message.includes('/')) {
            this._devices[rawAddress] = TibboDiscover.parseDeviceInfo(message, info);
        } else if (responseBit === ERR_BIT || responseBit === FAIL_BIT || responseBit === REJECT_BIT) {
            this._errors[rawAddress] = message.slice(0, 25);
        }

        if (responseBit === OK_BIT) {
            if (!this._seen[rawAddress]) {
                this._seen[rawAddress] = info.address;
                return this.sendQueryMessage(rawAddress);
            } else if (message.includes('/')) {
                this._devices[rawAddress] = TibboDiscover.parseDeviceInfo(message, info);
            }
        } else if (responseBit === ERR_BIT || responseBit === FAIL_BIT || responseBit === REJECT_BIT) {
            this._errors[rawAddress] = message;
        } else {
            this._messages[rawAddress] = message;
        }
    }

    private setupClient() {
        return new Promise((resolve) => {
            if (this._isBound) {
                resolve(true);
                return;
            }

            if (this._currentClient === undefined) {
                this._currentClient = createSocket('udp4');
            }

            const actualClient = this._currentClient!;


            actualClient.on('message', (buffer: Buffer, info: { address: string }) => {
                const message = buffer.toString();
                if (!!message) {
                    const matches = message.match(MAC_REGEX);

                    if (!!matches) {
                        this.processMessage(message, info)?.then();
                    }
                }
            });

            actualClient.once('listening', () => {
                this._isBound = true;

                actualClient.setBroadcast(true);
                resolve(true);
            });

            actualClient.bind();
        })
    }


    private scanForDeviceAddress(ipAddress: string, timeout: number = 1250, tries: number = 0): Promise<TibboDeviceInstance | null> {
        return this.scan(timeout).catch(() => {
            return this.scan(timeout + 2000);
        }).then(() => {
            let id = null;
            const ip = Object.values(this._seen).find(v => v === ipAddress);

            if (!!ip) {
                id = Object.keys(this._seen).find(key => this._seen[key] === ip);
            }

            if (!!id && !!ip) {
                return {
                    id, ip
                }
            }

            return null;
        }).then(device => {
            if (!device && tries <= MAX_SEARCH_TRIES) {
                return this.scanForDeviceAddress(ipAddress, this._scanTimeout, tries + 1);
            } else if (!device && tries > MAX_SEARCH_TRIES) {
                return null;
            }

            return device;
        });
    }

    private static parseDeviceInfo(message: string,
                                   info: { address: string }): TibboDevice {
        const [boardType, data, currentApp] = message.slice(26).split('/');
        const rawAddress = message.slice(0, 25);
        const macAddress = rawAddress
            .replace('[', '')
            .replace(']', '')
            .split('.').map(r => Number(r)).join(':');

        return {
            boardType: boardType.replace(/[<>]/g, ''),
            data,
            currentApp,
            address: info.address,
            id: rawAddress,
            macAddress
        }
    }


    private static buildBitMessage(bit: string, client: string, delimit: boolean = true): string {
        return `${START_BIT}${client}${bit}${delimit ? DELIMIT_BIT : ''}`;
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

        let noError = true;

        instance.reboot(target).catch((err) => {
            console.log('Could not find', target, err);
            noError = false;
        }).then(() => {
            if (noError) {
                console.log(target, 'rebooted');
            }
        });

    } else if (process.argv[2] === 'raw') {
        const target: string = process.argv[3];
        const message: string = process.argv[4];
        const noDelimit: boolean = process.argv[5] === 'false' || false

        if (!target) {
            throw new Error('No target specified');
        }

        if (!message) {
            throw new Error('No message specified');
        }

        let noError = true;

        instance.sendMessage(target, message, !noDelimit).catch((err) => {
            noError = false;
            return `Could not send message to ${target}: ${err}`;
        }).then((result) => {
            if (noError) {
                console.log(target, result);
            } else {
                console.error(result)
            }
        });
    } else {
        let timeout: number | undefined = Number(process.argv[2]);

        if (isNaN(timeout) || !timeout) {
            timeout = undefined;
        }

        instance.scan(timeout).then(devices => {
            console.log(JSON.stringify({devices}, null, 2));
        });
    }
}
