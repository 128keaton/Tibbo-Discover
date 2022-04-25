"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TibboDeviceServer = void 0;
const dgram_as_promised_1 = __importDefault(require("dgram-as-promised"));
const tibbo_helpers_1 = require("./tibbo-helpers");
const buffer_1 = require("buffer");
const promises_1 = require("timers/promises");
const tibbo_shared_1 = require("./tibbo-shared");
class TibboDeviceServer {
    constructor(key) {
        this.activeSockets = [];
        this.key = 'tibbo123';
        if (!!key && key.length) {
            this.key = key;
        }
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
                return socket.send(encodedMessage, 0, encodedMessage.length, tibbo_shared_1.TIBBO_BROADCAST_PORT, ipAddress);
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
    initializeSettings(ipAddress, password, key = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.initializeSettingsMessage(key));
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
            return Promise.all(settingMessages.map(setting => tibbo_helpers_1.TibboHelpers.iterateSend(socket, setting, ipAddress, tibbo_shared_1.TIBBO_BROADCAST_PORT)));
        }).then((results) => {
            return results.map((result, index) => ({
                success: result,
                setting: settings[index]
            }));
        }).then(results => socket.close().then(() => results));
    }
    stop() {
        const finished = () => {
            this.activeSockets.forEach(socket => socket.unref());
            this.activeSockets = [];
            return;
        };
        return Promise.all(this.activeSockets.map(socket => socket.close()))
            .then(() => finished())
            .catch(() => finished());
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
                        return socket.send(encodedMessage, 0, encodedMessage.length, tibbo_shared_1.TIBBO_BROADCAST_PORT, ipAddress);
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
exports.TibboDeviceServer = TibboDeviceServer;
