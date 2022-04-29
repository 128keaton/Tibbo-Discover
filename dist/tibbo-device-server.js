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
    constructor(debug = false, key) {
        this.activeSockets = [];
        this._debug = false;
        this.key = 'tibbo123';
        if (!!key && key.length) {
            this.key = key;
        }
    }
    get debug() {
        return this._debug;
    }
    set debug(debug) {
        this.debugPrint('info', 'Enabling debug printing...');
        this._debug = debug;
    }
    login(ipAddress, password, key = this.key, timeout = 3000) {
        const socket = dgram_as_promised_1.default.createSocket("udp4");
        const message = tibbo_helpers_1.TibboHelpers.loginMessage(password, key);
        const encodedMessage = buffer_1.Buffer.from(message);
        const abortController = new AbortController();
        const signal = abortController.signal;
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Logging into Tibbo at', ipAddress, 'with key', key, 'and password', tibbo_helpers_1.TibboHelpers.hidePassword(password), 'with timeout', timeout);
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Raw login message:', message);
        return new Promise((resolve) => {
            let didResolve = false;
            let message;
            this.setupLoginTimeout(resolve, key, signal, socket, timeout);
            socket.bind()
                .then(() => this.appendSocket(socket, true))
                .then(socket => socket.send(encodedMessage, 0, encodedMessage.length, tibbo_shared_1.TIBBO_BROADCAST_PORT, ipAddress))
                .then(() => socket.recv())
                .then(packet => {
                if (!!packet) {
                    message = packet.msg.toString();
                }
                return tibbo_helpers_1.TibboHelpers.processLoginResponse(packet);
            })
                .then(response => socket.close().catch(() => response).then(() => response))
                .then(response => ({
                success: (response || false),
                key,
                message
            }))
                .then(response => {
                didResolve = true;
                abortController.abort();
                resolve(response);
            });
        });
    }
    buzz(ipAddress, password, key = this.key) {
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Buzzing Tibbo at', ipAddress, 'with key', key, 'and password', tibbo_helpers_1.TibboHelpers.hidePassword(password));
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.buzzMessage(key));
    }
    reboot(ipAddress, password, key = this.key) {
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Rebooting Tibbo at', ipAddress, 'with key', key, 'and password', tibbo_helpers_1.TibboHelpers.hidePassword(password));
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.rebootMessage(key), true);
    }
    raw(ipAddress, password, message, key = this.key) {
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Running raw command on Tibbo at', ipAddress, 'with key', key, 'and password', tibbo_helpers_1.TibboHelpers.hidePassword(password), 'with command:', message);
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.rawMessage(message, key));
    }
    readSetting(ipAddress, password, setting, key = this.key) {
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Reading setting named', setting, 'on Tibbo at', ipAddress, 'with key', key, 'and password', tibbo_helpers_1.TibboHelpers.hidePassword(password));
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.getSettingMessage(setting, key), false, 10000)
            .then(response => tibbo_helpers_1.TibboHelpers.stripSettingsResponse(key, response));
    }
    initializeSettings(ipAddress, password, key = this.key) {
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Initializing settings on Tibbo at', ipAddress, 'with key', key, 'and password', tibbo_helpers_1.TibboHelpers.hidePassword(password));
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.initializeSettingsMessage(key));
    }
    async updateSetting(setting, value, ipAddress, password) {
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Updating setting named', setting, 'with value', value, 'on Tibbo at', ipAddress, 'and password', tibbo_helpers_1.TibboHelpers.hidePassword(password));
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
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Updating settings named on Tibbo at', ipAddress, 'and password', tibbo_helpers_1.TibboHelpers.hidePassword(password), 'with values', settings);
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
        }).then(results => socket.close().then(() => this.logout(ipAddress, password, didAuth.key)).then(() => results));
    }
    stop() {
        if (this.activeSockets.length === 0) {
            return new Promise(resolve => resolve());
        }
        tibbo_helpers_1.TibboHelpers.debugPrint('warning', 'Stop called on TibboDeviceServer instance');
        const finished = () => {
            this.activeSockets.forEach(socket => socket.unref());
            this.activeSockets = [];
            return;
        };
        return Promise.all(this.activeSockets.map(socket => socket.close()))
            .then(() => finished())
            .catch((err) => {
            tibbo_helpers_1.TibboHelpers.debugPrint('error', 'Error caught on closing sockets:', err);
            return finished();
        });
    }
    logout(ipAddress, password, key = this.key) {
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Logging out of Tibbo at', ipAddress, 'with key', key, 'and password', tibbo_helpers_1.TibboHelpers.hidePassword(password));
        return this.sendSingleAuthMessage(ipAddress, password, key, tibbo_helpers_1.TibboHelpers.logoutMessage(key), true);
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
            tibbo_helpers_1.TibboHelpers.debugPrint('success', 'Processing login response', result.message, 'responding with', encodedMessage.toString('utf8'));
            return socket.bind()
                .then(() => this.appendSocket(socket))
                .then(socket => socket.send(encodedMessage, 0, encodedMessage.length, tibbo_shared_1.TIBBO_BROADCAST_PORT, ipAddress))
                .catch(() => resolver({ message: 'Could not send message' }));
        }
        else {
            TibboDeviceServer.handleDenied(resolver, result.message);
        }
    }
    setupLoginTimeout(resolver, key, signal, socket, timeout = 2000) {
        (0, promises_1.setTimeout)(timeout, 'timeout', { signal })
            .then(() => Promise.all([this.stop(), socket.close()])
            .then(() => resolver({ key, message: 'ERR_TIMEOUT', success: false })))
            .catch((err) => {
            let errorCode = 'ERR_TIMEOUT';
            if (!!err && err.hasOwnProperty('code')) {
                errorCode = err['code'];
            }
            resolver({ key, message: errorCode, success: false });
        });
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
        tibbo_helpers_1.TibboHelpers.debugPrint('info', 'Sending single authenticated message to IP', ipAddress, 'with password', tibbo_helpers_1.TibboHelpers.hidePassword(password), 'and key', key, 'with message contents:', message);
        return new Promise(resolve => {
            this.setupTimeout(resolve, signal, socket, timeout, expectTimeout);
            this.login(ipAddress, password, key, timeout)
                .then(result => this.handleLoginResponse(result, encodedMessage, ipAddress, socket, resolve))
                .then(() => socket.recv())
                .then(packet => TibboDeviceServer.handleGenericPacket(abortController, packet))
                .then(response => {
                if (message !== tibbo_helpers_1.TibboHelpers.logoutMessage(key) && response.data !== undefined) {
                    return this.logout(ipAddress, password, key).then(() => response);
                }
                return response;
            })
                .then(response => this.stop().then(() => resolve(response)));
        });
    }
    debugPrint(color = 'none', ...data) {
        if (this.debug) {
            tibbo_helpers_1.TibboHelpers.debugPrint(color, data);
        }
    }
    static handleGenericPacket(abortController, packet) {
        const denied = tibbo_helpers_1.TibboHelpers.checkIfDenied(packet);
        let data = undefined;
        abortController.abort();
        if (denied) {
            tibbo_helpers_1.TibboHelpers.debugPrint('error', 'Access denied from handleGenericPacket');
            return { message: 'ACCESS_DENIED' };
        }
        if (packet) {
            data = packet.msg.toString();
            tibbo_helpers_1.TibboHelpers.debugPrint('success', 'Data from handleGenericPacket:', data);
        }
        return { message: 'SUCCESS', data };
    }
    static handleDenied(resolver, message) {
        tibbo_helpers_1.TibboHelpers.debugPrint('error', 'Access denied from handleDenied');
        resolver({ message: (!!message ? message : 'ACCESS_DENIED'), success: false });
    }
}
exports.TibboDeviceServer = TibboDeviceServer;
/* istanbul ignore if */
if (require.main == module) {
    const tibboDeviceServer = new TibboDeviceServer();
    commander_1.program
        .name('tibbo-device-server')
        .description('CLI to modify DS-Tibbo devices on the network')
        .version(tibbo_shared_1.PACKAGE_VERSION)
        .option('-d, --debug', 'output extra debugging');
    commander_1.program
        .command('login')
        .description('Login to a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .action((ipAddress, password) => {
        tibboDeviceServer.debug = commander_1.program.opts()['debug'];
        tibboDeviceServer.login(ipAddress, password)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2)));
    });
    commander_1.program
        .command('buzz')
        .description('Buzz a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to buzz')
        .argument('<password>', 'Password of the Tibbo device to buzz')
        .action((ipAddress, password) => {
        tibboDeviceServer.debug = commander_1.program.opts()['debug'];
        tibboDeviceServer.buzz(ipAddress, password)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2)));
    });
    commander_1.program
        .command('reboot')
        .description('Reboot a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to reboot')
        .argument('<password>', 'Password of the Tibbo device to reboot')
        .action((ipAddress, password) => {
        tibboDeviceServer.debug = commander_1.program.opts()['debug'];
        tibboDeviceServer.reboot(ipAddress, password)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2)));
    });
    commander_1.program
        .command('raw')
        .description('Send a raw command to a Tibbo DS on the network')
        .argument('<ipAddress>', 'IP address of Tibbo device to send the raw command rto')
        .argument('<password>', 'Password of the Tibbo device to send the raw command to')
        .argument('<raw>', 'The raw command')
        .action((ipAddress, password, raw) => {
        tibboDeviceServer.debug = commander_1.program.opts()['debug'];
        tibboDeviceServer.raw(ipAddress, password, raw)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2)));
    });
    const setting = commander_1.program.command('setting');
    setting.command('set')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<setting>', 'Setting name on the Tibbo device')
        .argument('<value>', 'New value of the setting')
        .action((ipAddress, password, setting, value) => {
        tibboDeviceServer.debug = commander_1.program.opts()['debug'];
        tibboDeviceServer.updateSetting(setting, value, ipAddress, password)
            .then(result => tibboDeviceServer.stop().then(() => result))
            .then(result => console.log(JSON.stringify(result, null, 2)));
    });
    setting.command('get')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<setting>', 'Setting name on the Tibbo device')
        .action((ipAddress, password, setting) => {
        tibboDeviceServer.debug = commander_1.program.opts()['debug'];
        tibboDeviceServer.readSetting(ipAddress, password, setting)
            .then(result => tibboDeviceServer.stop().then(() => {
            const object = {};
            object[setting] = result;
            return object;
        }))
            .then(result => console.log(JSON.stringify(result, null, 2)));
    });
    setting.command('set-multiple')
        .description('Update a setting on the Tibbo device')
        .argument('<ipAddress>', 'IP address of Tibbo device to login into')
        .argument('<password>', 'Password of the Tibbo device to login into')
        .argument('<settings>', 'Comma-separated values to set')
        .action((ipAddress, password, csv) => {
        tibboDeviceServer.debug = commander_1.program.opts()['debug'];
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
