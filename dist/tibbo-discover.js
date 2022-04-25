#! /usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TibboDiscover = void 0;
const promises_1 = require("timers/promises");
const dgram_as_promised_1 = __importDefault(require("dgram-as-promised"));
const buffer_1 = require("buffer");
const tibbo_helpers_1 = require("./tibbo-helpers");
const tibbo_shared_1 = require("./tibbo-shared");
const commander_1 = require("commander");
class TibboDiscover {
    constructor() {
        this.devices = {};
        this.activeSockets = [];
    }
    scan(timeout = 5000) {
        return this.sendBroadcastMessage(tibbo_helpers_1.TibboHelpers.discoverMessage).then(() => {
            return new Promise(resolve => {
                (0, promises_1.setTimeout)(timeout).then(() => {
                    this.stop().then(devices => resolve(devices));
                });
            });
        });
    }
    query(id, timeout = 1500) {
        return new Promise(resolve => {
            let didResolve = false;
            this.sendBroadcastMessage(tibbo_helpers_1.TibboHelpers.queryMessage(id))
                .then(socket => socket.recv())
                .then(packet => tibbo_helpers_1.TibboHelpers.processQueryResponse(id, packet))
                .then(result => {
                didResolve = true;
                resolve(result);
            });
            (0, promises_1.setTimeout)(timeout).then(() => {
                if (!didResolve) {
                    resolve(null);
                }
            });
        });
    }
    stop() {
        const finished = () => {
            this.activeSockets.forEach(socket => socket.unref());
            this.activeSockets = [];
            return Object.values(this.devices);
        };
        return Promise.all(this.activeSockets.map(socket => socket.close()))
            .then(() => finished())
            .catch(() => finished());
    }
    sendBroadcastMessage(message) {
        const socket = dgram_as_promised_1.default.createSocket("udp4");
        const encodedMessage = buffer_1.Buffer.from(message);
        return socket.bind().then(() => {
            this.activeSockets.push(socket);
            socket.setBroadcast(true);
            socket.socket.on('message', (msg) => {
                const tibboID = tibbo_helpers_1.TibboHelpers.getMacAddress(msg);
                if (!!tibboID && !this.devices[tibboID]) {
                    return this.query(tibboID).then(result => {
                        if (!!result)
                            this.devices[tibboID] = result;
                    });
                }
            });
            return socket.send(encodedMessage, 0, encodedMessage.length, tibbo_shared_1.TIBBO_BROADCAST_PORT, tibbo_shared_1.TIBBO_BROADCAST_ADDR);
        }).then(() => socket);
    }
}
exports.TibboDiscover = TibboDiscover;
/* istanbul ignore if */
if (require.main == module) {
    const tibboDiscover = new TibboDiscover();
    commander_1.program
        .name('tibbo-discover')
        .description('CLI to discover Tibbo devices on the network')
        .version(tibbo_shared_1.PACKAGE_VERSION);
    commander_1.program
        .command('query')
        .description('Query a specific device on the network')
        .argument('<id>', 'ID of Tibbo device to query')
        .addOption(new commander_1.Option('-t, --timeout <delay>', 'timeout in milliseconds').default(4000, 'four seconds'))
        .action((id, strTimeout) => {
        let timeout = Number(strTimeout);
        if (isNaN(timeout)) {
            timeout = undefined;
        }
        return tibboDiscover.query(id, timeout)
            .then(result => tibboDiscover.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2)));
    });
    commander_1.program
        .command('scan')
        .description('Scan for devices on the network')
        .addOption(new commander_1.Option('-t, --timeout <delay>', 'timeout in milliseconds').default(4000, 'four seconds'))
        .action((strTimeout) => {
        let timeout = Number(strTimeout);
        if (isNaN(timeout)) {
            timeout = undefined;
        }
        return tibboDiscover.scan(timeout)
            .then(result => tibboDiscover.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2)));
    });
    commander_1.program.parse();
}
