#! /usr/bin/env node
import {setTimeout} from 'timers/promises';
import DgramAsPromised, {SocketAsPromised} from "dgram-as-promised";
import {Buffer} from "buffer";
import {TibboHelpers} from "./tibbo-helpers";
import {TibboDevice} from "./tibbo-types";
import {PACKAGE_VERSION, TIBBO_BROADCAST_ADDR, TIBBO_BROADCAST_PORT} from "./tibbo-shared";
import {Option, program} from "commander";


export class TibboDiscover {

    private devices: { [key: string]: TibboDevice } = {};
    private activeSockets: SocketAsPromised[] = [];
    private _debug: boolean = false;

    get debug(): boolean {
        return this._debug;
    }

    set debug(debug: boolean) {
        this.debugPrint('info', 'Enabling debug printing...');
        this._debug = debug;
        TibboHelpers.enableDebugPrinting = debug;
    }

    public scan(timeout: number = 5000): Promise<TibboDevice[]> {
        TibboHelpers.debugPrint('info', 'Scanning for Tibbo devices ');
        return this.sendBroadcastMessage(TibboHelpers.discoverMessage).then(() => {
            return new Promise(resolve => {
                setTimeout(timeout).then(() => {
                    this.stop().then(devices => resolve(devices))
                })
            })
        })
    }

    public query(id: string, timeout: number = 1500): Promise<TibboDevice | null> {
        TibboHelpers.debugPrint('success', 'Querying Tibbo with ID ', id);
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
        if (this.activeSockets.length === 0) {
            return new Promise<TibboDevice[]>(resolve => resolve(Object.values(this.devices)))
        }

        TibboHelpers.debugPrint('warning', 'Stop called on TibboDiscover instance');

        const finished = () => {
            this.activeSockets.forEach(socket => socket.unref());
            this.activeSockets = [];
            return Object.values(this.devices)
        }

        return Promise.all(this.activeSockets.map(socket => socket.close()))
            .then(() => finished())
            .catch((err) => {
                TibboHelpers.debugPrint('error', 'Error caught on closing sockets:', err);
                return finished();
            });
    }

    private sendBroadcastMessage(message: string) {
        const socket = DgramAsPromised.createSocket("udp4");
        const encodedMessage = Buffer.from(message);

        TibboHelpers.debugPrint('info', 'Sending broadcast message', message, 'to', `${TIBBO_BROADCAST_ADDR}:${TIBBO_BROADCAST_PORT}`);
        return socket.bind().then(() => {
            this.activeSockets.push(socket);

            socket.setBroadcast(true);

            socket.socket.on('message', (msg) => {
                const tibboID = TibboHelpers.getMacAddress(msg);

                if (!!tibboID && !this.devices[tibboID]) {
                    TibboHelpers.debugPrint('success', 'New Tibbo found, ID =', tibboID);
                    return this.query(tibboID).then(result => {
                        if (!!result)
                            this.devices[tibboID] = result;
                    })
                }
            });

            return socket.send(encodedMessage, 0, encodedMessage.length, TIBBO_BROADCAST_PORT, TIBBO_BROADCAST_ADDR);
        }).then(() => socket);
    }

    private debugPrint(color: 'success' | 'info' | 'error' | 'warning' | 'none' = 'none', ...data: any[]) {
        if (this.debug) {
            TibboHelpers.debugPrint(color, data);
        }
    }
}

/* istanbul ignore if */
if (require.main == module) {
    const tibboDiscover = new TibboDiscover();

    program
        .name('tibbo-discover')
        .description('CLI to discover Tibbo devices on the network')
        .version(PACKAGE_VERSION)
        .option('-d, --debug', 'output extra debugging');

    program
        .command('query')
        .description('Query a specific device on the network')
        .argument('<id>', 'ID of Tibbo device to query')
        .addOption(new Option('-t, --timeout <delay>', 'timeout in milliseconds').default(4000, 'four seconds'))
        .action((id, strTimeout) => {
            tibboDiscover.debug = program.opts()['debug'];
            let timeout: undefined | number = Number(strTimeout);

            if (isNaN(timeout)) {
                timeout = undefined;
            }

            return tibboDiscover.query(id, timeout)
                .then(result => tibboDiscover.stop().then(() => result))
                .then(result => console.log(JSON.stringify(result, null, 2)));
        });

    program
        .command('scan')
        .description('Scan for devices on the network')
        .addOption(new Option('-t, --timeout <delay>', 'timeout in milliseconds').default(4000, 'four seconds'))
        .action((strTimeout) => {
            tibboDiscover.debug = program.opts()['debug'];
            let timeout: undefined | number = Number(strTimeout);

            if (isNaN(timeout)) {
                timeout = undefined;
            }

            return tibboDiscover.scan(timeout)
                .then(result => tibboDiscover.stop().then(() => result))
                .then(result => console.log(JSON.stringify(result, null, 2)));
        });

    program.parse();
}
