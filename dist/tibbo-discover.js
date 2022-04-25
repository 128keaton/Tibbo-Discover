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
const BROADCAST_PORT = 65535;
const BROADCAST_ADDR = '255.255.255.255';
class TibboDiscover {
    constructor(key) {
        this.devices = {};
        this.activeSockets = [];
        this.key = 'tibbo123';
        if (!!key && key.length) {
            this.key = key;
        }
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
    login(ipAddress, password, key = this.key) {
        const socket = dgram_as_promised_1.default.createSocket("udp4");
        const message = tibbo_helpers_1.TibboHelpers.loginMessage(password, key);
        const encodedMessage = buffer_1.Buffer.from(message);
        const ac = new AbortController();
        const signal = ac.signal;
        return new Promise((resolve) => {
            let didResolve = false;
            (0, promises_1.setTimeout)(3000, 'timeout', { signal }).then(() => {
                if (!didResolve) {
                    this.stop().then(() => {
                        resolve({ key, success: false, message: 'ERR_TIMEOUT' });
                    }).catch(() => {
                        resolve({ key, success: false, message: 'ERR_TIMEOUT' });
                    });
                }
            }).catch(() => resolve({ key, success: false, message: 'ERR_TIMEOUT' }));
            socket.bind().then(() => {
                this.activeSockets.push(socket);
                socket.setBroadcast(true);
                return socket.send(encodedMessage, 0, encodedMessage.length, BROADCAST_PORT, ipAddress);
            }).then(() => socket.recv())
                .then(packet => tibbo_helpers_1.TibboHelpers.processLoginResponse(packet))
                .then(response => {
                return socket.close()
                    .catch(() => response)
                    .then(() => response);
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
        });
    }
    buzz(ipAddress, password, key = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.buzzMessage(key));
    }
    reboot(ipAddress, password, key = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.rebootMessage(key));
    }
    async updateSetting(setting, value, ipAddress, password) {
        const settings = [
            {
                settingValue: value,
                settingName: setting
            }
        ];
        return this.updateSettings(settings, ipAddress, password);
    }
    async updateSettings(settings, ipAddress, password) {
        const didAuth = await this.login(ipAddress, password);
        if (!didAuth.success) {
            return didAuth;
        }
        const socket = dgram_as_promised_1.default.createSocket("udp4");
        const settingMessages = settings.map(setting => tibbo_helpers_1.TibboHelpers.updateSettingMessage(setting.settingName, setting.settingValue, didAuth.key))
            .map(string => buffer_1.Buffer.from(string));
        return socket.bind().then(() => {
            this.activeSockets.push(socket);
            socket.setBroadcast(true);
            return Promise.all(settingMessages.map(setting => tibbo_helpers_1.TibboHelpers.iterateSend(socket, setting, ipAddress, BROADCAST_PORT)));
        }).then((results) => {
            return results.map((result, index) => ({
                success: result,
                setting: settings[index]
            }));
        }).then(results => socket.close().then(() => results));
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
            return socket.send(encodedMessage, 0, encodedMessage.length, BROADCAST_PORT, BROADCAST_ADDR);
        }).then(() => socket);
    }
    sendSingleAuthMessage(ipAddress, password, key, message) {
        const socket = dgram_as_promised_1.default.createSocket("udp4");
        const encodedMessage = buffer_1.Buffer.from(message);
        const ac = new AbortController();
        const signal = ac.signal;
        return new Promise(resolve => {
            (0, promises_1.setTimeout)(1000, 'timeout', { signal }).then(() => {
                Promise.all([this.stop(), socket.close()])
                    .catch(() => resolve({ message: 'Success' }))
                    .then(() => resolve({ message: 'Success' }));
            }).catch(() => resolve({ message: 'Success' }));
            this.login(ipAddress, password, key).then(result => {
                if (!result.success) {
                    resolve({ message: 'Access denied' });
                }
                else {
                    return socket.bind().then(() => {
                        this.activeSockets.push(socket);
                        socket.setBroadcast(true);
                        return socket.send(encodedMessage, 0, encodedMessage.length, BROADCAST_PORT, ipAddress);
                    }).catch(() => resolve(false));
                }
            }).then(() => socket.recv()).then(packet => {
                const denied = tibbo_helpers_1.TibboHelpers.checkIfDenied(packet);
                ac.abort();
                if (denied) {
                    return { message: 'Access denied' };
                }
                return { message: 'Success' };
            }).then(response => this.stop().then(() => response));
        });
    }
}
exports.TibboDiscover = TibboDiscover;
/* istanbul ignore if */
if (require.main == module) {
    const instance = new TibboDiscover();
    let promise;
    if (process.argv[2] === 'login') {
        const ipAddress = process.argv[3];
        const password = process.argv[4];
        promise = instance.login(ipAddress, password);
    }
    else if (process.argv[2] === 'setting') {
        const ipAddress = process.argv[3];
        const password = process.argv[4];
        const setting = process.argv[5];
        const value = process.argv[6];
        promise = instance.updateSetting(setting, value, ipAddress, password);
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
        promise = instance.updateSettings(settings, ipAddress, password);
    }
    else if (process.argv[2] === 'buzz') {
        const ipAddress = process.argv[3];
        const password = process.argv[4];
        const key = process.argv[5];
        promise = instance.buzz(ipAddress, password, key);
    }
    else if (process.argv[2] === 'reboot') {
        const ipAddress = process.argv[3];
        const password = process.argv[4];
        const key = process.argv[5];
        promise = instance.reboot(ipAddress, password, key);
    }
    else if (process.argv[2] === 'query') {
        const id = process.argv[3];
        let timeout = Number(process.argv[4]);
        if (isNaN(timeout)) {
            timeout = undefined;
        }
        promise = instance.query(id, timeout).then(result => instance.stop().then(() => result));
    }
    else {
        let timeout = Number(process.argv[2]);
        if (isNaN(timeout)) {
            timeout = undefined;
        }
        promise = instance.scan(timeout);
    }
    promise.then(result => console.log(JSON.stringify(result, null, 2)));
}
