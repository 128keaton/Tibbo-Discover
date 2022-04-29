"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TibboHelpers = void 0;
const chalk_1 = __importDefault(require("chalk"));
// Regex Patterns
const MAC_REGEX = /\[\d..\.\d..\.\d..\.\d..\.\d..\.\d..]/;
const BOARD_REGEX = /<.*>/;
// Request bits
const START_BIT = '_';
const DISCOVER_BIT = '?';
const QUERY_BIT = 'X';
const DELIMIT_BIT = '|';
const BUZZ_BIT = 'B';
const REBOOT_BIT = 'E';
const INIT_BIT = 'I';
const LOGIN_BIT = 'L';
const LOGOUT_BIT = 'O';
const UPDATE_SETTING_BIT = 'S';
const READ_SETTING_BIT = 'G';
// Response bits
const ERR_BIT = 'C';
const REJECT_BIT = 'R';
const FAIL_BIT = 'F';
const DENY_BIT = 'D';
class TibboHelpers {
    static get discoverMessage() {
        return `${START_BIT}${DISCOVER_BIT}`;
    }
    static processQueryResponse(id, packet) {
        if (!packet) {
            return null;
        }
        const rawMessage = packet.msg.toString().split('/');
        const board = rawMessage[0].match(BOARD_REGEX)[0]
            .replace('<', '')
            .replace('>', '');
        const application = rawMessage[2];
        const ipAddress = packet.rinfo.address;
        return {
            board, application, ipAddress, id
        };
    }
    static processLoginResponse(packet) {
        if (!packet) {
            return null;
        }
        const rawMessage = packet.msg.toString();
        TibboHelpers.debugPrint('info', `Raw login response: ${rawMessage}`);
        return rawMessage[0] !== DENY_BIT &&
            rawMessage[0] !== REJECT_BIT &&
            rawMessage[0] !== FAIL_BIT &&
            rawMessage[0] !== ERR_BIT;
    }
    static processSettingResponse(packet) {
        if (!packet) {
            return false;
        }
        const rawMessage = packet.msg.toString();
        return rawMessage[0] !== DENY_BIT &&
            rawMessage[0] !== REJECT_BIT &&
            rawMessage[0] !== FAIL_BIT &&
            rawMessage[0] !== ERR_BIT;
    }
    static queryMessage(id) {
        if (!id.includes('[')) {
            id = `[${id}]`;
        }
        return `${START_BIT}${id}${QUERY_BIT}`;
    }
    static rebootMessage(key) {
        return `${REBOOT_BIT}${DELIMIT_BIT}${key}`;
    }
    static rawMessage(rawMessage, key) {
        return `${rawMessage}${DELIMIT_BIT}${key}`;
    }
    static getSettingMessage(setting, key) {
        return `${READ_SETTING_BIT}${setting}${DELIMIT_BIT}${key}`;
    }
    static initializeSettingsMessage(key) {
        return `${INIT_BIT}${DELIMIT_BIT}${key}`;
    }
    static buzzMessage(key) {
        return `${BUZZ_BIT}${DELIMIT_BIT}${key}`;
    }
    static logoutMessage(key) {
        return `${LOGOUT_BIT}${DELIMIT_BIT}${key}`;
    }
    static updateSettingMessage(setting, value, key) {
        return `${UPDATE_SETTING_BIT}${setting}@${value}${DELIMIT_BIT}${key}`;
    }
    static loginMessage(password, key) {
        return `${LOGIN_BIT}${password}${DELIMIT_BIT}${key}`;
    }
    static getMacAddress(buffer) {
        const message = buffer.toString();
        const matches = message.match(MAC_REGEX);
        if (!!matches && matches.length > 0) {
            return matches[0];
        }
        return null;
    }
    static stripSettingsResponse(key, rawResponse) {
        if (!!rawResponse && rawResponse.data) {
            return rawResponse.data.slice(1, rawResponse.data.length).replace(`${DELIMIT_BIT}${key}`, '');
        }
        return null;
    }
    static iterateSend(socket, setting, ipAddress, port) {
        return new Promise(resolve => {
            socket.send(setting, 0, setting.length, port, ipAddress)
                .then(() => socket.recv())
                .then((packet) => resolve(this.processSettingResponse(packet)));
        });
    }
    static checkIfDenied(packet) {
        if (!packet) {
            return false;
        }
        const message = packet.msg.toString();
        return message === `${DENY_BIT}${DELIMIT_BIT}` || message === DENY_BIT;
    }
    static hidePassword(password) {
        const length = (password.length > 4 ? 4 : ((password.length - 2)));
        return password.slice(0, -(length)).replace(/./g, '*') + password.slice(-(length));
    }
    static debugPrint(color = 'none', ...data) {
        const log = console.log;
        const logData = chalk_1.default.magenta('[Tibbo Discover] - ') + data.join(' ');
        switch (color) {
            case 'success':
                log(chalk_1.default.green(logData));
                break;
            case 'info':
                log(chalk_1.default.cyanBright(logData));
                break;
            case 'error':
                log(chalk_1.default.redBright(logData));
                break;
            case 'warning':
                log(chalk_1.default.yellowBright(logData));
                break;
            case "none":
                log(data);
                break;
        }
    }
}
exports.TibboHelpers = TibboHelpers;
