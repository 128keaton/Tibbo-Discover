"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TibboHelpers = void 0;
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
const UPDATE_SETTING_BIT = 'S';
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
    static initializeSettingsMessage(key) {
        return `${INIT_BIT}${DELIMIT_BIT}${key}`;
    }
    static buzzMessage(key) {
        return `${BUZZ_BIT}${DELIMIT_BIT}${key}`;
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
}
exports.TibboHelpers = TibboHelpers;
