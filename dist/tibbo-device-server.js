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
const commander_1 = require("commander");
class TibboDeviceServer {
    constructor(key) {
        this.activeSockets = [];
        this.key = 'tibbo123';
        if (!!key && key.length) {
            this.key = key;
        }
    }
    login(ipAddress, password, key = this.key, timeout = 3000) {
        const socket = dgram_as_promised_1.default.createSocket("udp4");
        const message = tibbo_helpers_1.TibboHelpers.loginMessage(password, key);
        const encodedMessage = buffer_1.Buffer.from(message);
        const abortController = new AbortController();
        const signal = abortController.signal;
        return new Promise((resolve) => {
            let didResolve = false;
            this.setupLoginTimeout(resolve, key, signal, socket, timeout);
            socket.bind()
                .then(() => this.appendSocket(socket, true))
                .then(socket => socket.send(encodedMessage, 0, encodedMessage.length, tibbo_shared_1.TIBBO_BROADCAST_PORT, ipAddress))
                .then(() => socket.recv())
                .then(packet => tibbo_helpers_1.TibboHelpers.processLoginResponse(packet))
                .then(response => socket.close().catch(() => response).then(() => response))
                .then(response => ({
                success: (response || false),
                key,
            }))
                .then(response => {
                didResolve = true;
                abortController.abort();
                resolve(response);
            });
        });
    }
    buzz(ipAddress, password, key = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.buzzMessage(key));
    }
    reboot(ipAddress, password, key = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.rebootMessage(key), true);
    }
    raw(ipAddress, password, message, key = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.rawMessage(message, key));
    }
    readSetting(ipAddress, password, setting, key = this.key) {
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.getSettingMessage(setting, key), false, 10000)
            .then(response => tibbo_helpers_1.TibboHelpers.stripSettingsResponse(key, response));
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
        return socket.bind()
            .then(() => this.appendSocket(socket, true))
            .then(socket => Promise.all(settingMessages.map(setting => tibbo_helpers_1.TibboHelpers.iterateSend(socket, setting, ipAddress, tibbo_shared_1.TIBBO_BROADCAST_PORT))))
            .then((results) => {
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
    static handleTimeout(expectTimeout, resolver) {
        if (expectTimeout) {
            resolver({ message: 'SUCCESS' });
        }
        else {
            resolver({ message: 'ERR_TIMEOUT' });
        }
    }
    appendSocket(socket, broadcast = false) {
        if (broadcast) {
            socket.setBroadcast(true);
        }
        this.activeSockets.push(socket);
        return socket;
    }
    handleLoginResponse(result, encodedMessage, ipAddress, socket, resolver) {
        if (result.success) {
            return socket.bind()
                .then(() => this.appendSocket(socket))
                .then(socket => socket.send(encodedMessage, 0, encodedMessage.length, tibbo_shared_1.TIBBO_BROADCAST_PORT, ipAddress))
                .catch(() => resolver({ message: 'Could not send message' }));
        }
        else {
            TibboDeviceServer.handleDenied(resolver);
        }
    }
    setupLoginTimeout(resolver, key, signal, socket, timeout = 2000) {
        (0, promises_1.setTimeout)(timeout, 'timeout', { signal })
            .then(() => Promise.all([this.stop(), socket.close()])
            .then(() => resolver({ key, message: 'ERR_TIMEOUT', success: false })))
            .catch(() => resolver({ key, message: 'ERR_TIMEOUT', success: false }));
    }
    setupTimeout(resolver, signal, socket, timeout = 2000, expectTimeout = false) {
        (0, promises_1.setTimeout)(timeout, 'timeout', { signal })
            .then(() => Promise.all([this.stop(), socket.close()])
            .then(() => TibboDeviceServer.handleTimeout(expectTimeout, resolver)))
            .catch(() => {
        });
    }
    sendSingleAuthMessage(ipAddress, password, key, message, expectTimeout = false, timeout = 2000) {
        const socket = dgram_as_promised_1.default.createSocket("udp4");
        const encodedMessage = buffer_1.Buffer.from(message);
        const abortController = new AbortController();
        const signal = abortController.signal;
        return new Promise(resolve => {
            this.setupTimeout(resolve, signal, socket, timeout, expectTimeout);
            this.login(ipAddress, password, key, timeout)
                .then(result => this.handleLoginResponse(result, encodedMessage, ipAddress, socket, resolve))
                .then(() => socket.recv())
                .then(packet => TibboDeviceServer.handleGenericPacket(abortController, packet))
                .then(response => this.stop().then(() => resolve(response)));
        });
    }
    static handleGenericPacket(abortController, packet) {
        const denied = tibbo_helpers_1.TibboHelpers.checkIfDenied(packet);
        abortController.abort();
        if (denied) {
            return { message: 'ACCESS_DENIED' };
        }
        if (packet) {
            return { message: 'Success', data: packet.msg.toString() };
        }
        return { message: 'SUCCESS' };
    }
    static handleDenied(resolver) {
        resolver({ message: 'ACCESS_DENIED' });
    }
}
exports.TibboDeviceServer = TibboDeviceServer;
/* istanbul ignore if */
if (require.main == module) {
    const tibboDeviceServer = new TibboDeviceServer();
    commander_1.program
        .name('tibbo-device-server')
        .description('CLI to modify DS-Tibbo devices on the network')
        .version(tibbo_shared_1.PACKAGE_VERSION);
    commander_1.program
        .command('login')
        .description('Login to a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .action((ipAddress, password) => tibboDeviceServer.login(ipAddress, password)
        .then(result => tibboDeviceServer.stop().then(() => result))
        .then(result => console.log(JSON.stringify(result, null, 2))));
    commander_1.program
        .command('buzz')
        .description('Buzz a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to buzz')
        .argument('<password>', 'Password of the Tibbo device to buzz')
        .action((ipAddress, password) => tibboDeviceServer.buzz(ipAddress, password)
        .then(result => tibboDeviceServer.stop().then(() => result))
        .then(result => console.log(JSON.stringify(result, null, 2))));
    commander_1.program
        .command('reboot')
        .description('Reboot a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to reboot')
        .argument('<password>', 'Password of the Tibbo device to reboot')
        .action((ipAddress, password) => tibboDeviceServer.reboot(ipAddress, password)
        .then(result => tibboDeviceServer.stop().then(() => result))
        .then(result => console.log(JSON.stringify(result, null, 2))));
    commander_1.program
        .command('raw')
        .description('Send a raw command to a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to send the raw command rto')
        .argument('<password>', 'Password of the Tibbo device to send the raw command to')
        .argument('<raw>', 'The raw command')
        .action((ipAddress, password, raw) => tibboDeviceServer.raw(ipAddress, password, raw)
        .then(result => tibboDeviceServer.stop().then(() => result))
        .then(result => console.log(JSON.stringify(result, null, 2))));
    const setting = commander_1.program.command('setting');
    setting.command('set')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<setting>', 'Setting name on the Tibbo device')
        .argument('<value>', 'New value of the setting')
        .action((ipAddress, password, setting, value) => tibboDeviceServer.updateSetting(setting, value, ipAddress, password)
        .then(result => tibboDeviceServer.stop().then(() => result))
        .then(result => console.log(JSON.stringify(result, null, 2))));
    setting.command('get')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<setting>', 'Setting name on the Tibbo device')
        .action((ipAddress, password, setting) => tibboDeviceServer.readSetting(ipAddress, password, setting)
        .then(result => tibboDeviceServer.stop().then(() => {
        const object = {};
        object[setting] = result;
        return object;
    }))
        .then(result => console.log(JSON.stringify(result, null, 2))));
    setting.command('set-multiple')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<settings>', 'Comma-separated values to set')
        .action((ipAddress, password, csv) => {
        const rawSettings = csv.split(',');
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
        return tibboDeviceServer.updateSettings(settings, ipAddress, password)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2)));
    });
    commander_1.program.parse();
}
