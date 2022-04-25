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
const tibbo_device_server_1 = require("./tibbo-device-server");
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
    const tibboDeviceServer = new tibbo_device_server_1.TibboDeviceServer();
    let promise;
    if (process.argv[2] === 'login') {
        const ipAddress = process.argv[3];
        const password = process.argv[4];
        promise = tibboDeviceServer.login(ipAddress, password);
    }
    else if (process.argv[2] === 'setting') {
        const ipAddress = process.argv[3];
        const password = process.argv[4];
        const setting = process.argv[5];
        const value = process.argv[6];
        promise = tibboDeviceServer.updateSetting(setting, value, ipAddress, password);
    }
    else if (process.argv[2] === 'settings') {
        const ipAddress = process.argv[3];
        const password = process.argv[4];
        const rawSettings = process.argv[5].split(',');
        const settings = [];
        let currentSetting;
        rawSettings.forEach((value, index) => {
            if (index % 2 === 0) {
                currentSetting = value;
            }
            else {
                settings.push({
                    settingName: currentSetting,
                    settingValue: value
                });
            }
        });
        promise = tibboDeviceServer.updateSettings(settings, ipAddress, password);
    }
    else if (process.argv[2] === 'buzz') {
        const ipAddress = process.argv[3];
        const password = process.argv[4];
        const key = process.argv[5];
        promise = tibboDeviceServer.buzz(ipAddress, password, key);
    }
    else if (process.argv[2] === 'reboot') {
        const ipAddress = process.argv[3];
        const password = process.argv[4];
        const key = process.argv[5];
        promise = tibboDeviceServer.reboot(ipAddress, password, key);
    }
    else if (process.argv[2] === 'query') {
        const id = process.argv[3];
        let timeout = Number(process.argv[4]);
        if (isNaN(timeout)) {
            timeout = undefined;
        }
        promise = tibboDiscover.query(id, timeout).then(result => tibboDiscover.stop().then(() => result));
    }
    else {
        let timeout = Number(process.argv[2]);
        if (isNaN(timeout)) {
            timeout = undefined;
        }
        promise = tibboDiscover.scan(timeout);
    }
    promise.then(result => console.log(JSON.stringify(result, null, 2)));
}
