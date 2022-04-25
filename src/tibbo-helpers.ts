import {IncomingPacket, SocketAsPromised} from "dgram-as-promised";
import {Buffer} from "buffer";
import {TibboDevice} from "./tibbo-types";


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


export class TibboHelpers {

    public static get discoverMessage() {
        return `${START_BIT}${DISCOVER_BIT}`;
    }

    public static processQueryResponse(id: string, packet?: IncomingPacket): TibboDevice | null {
        if (!packet) {
            return null;
        }

        const rawMessage = packet.msg.toString().split('/');
        const board = rawMessage[0].match(BOARD_REGEX)![0]
            .replace('<', '')
            .replace('>', '');

        const application = rawMessage[2];
        const ipAddress = packet.rinfo.address;

        return {
            board, application, ipAddress, id
        }
    }

    public static processLoginResponse(packet?: IncomingPacket) {
        if (!packet) {
            return null;
        }

        const rawMessage = packet.msg.toString();

        return rawMessage[0] !== DENY_BIT &&
            rawMessage[0] !== REJECT_BIT &&
            rawMessage[0] !== FAIL_BIT &&
            rawMessage[0] !== ERR_BIT;
    }

    public static processSettingResponse(packet?: IncomingPacket) {
        if (!packet) {
            return false;
        }

        const rawMessage = packet.msg.toString();
        return rawMessage[0] !== DENY_BIT &&
            rawMessage[0] !== REJECT_BIT &&
            rawMessage[0] !== FAIL_BIT &&
            rawMessage[0] !== ERR_BIT;
    }

    public static queryMessage(id: string): string {
        if (!id.includes('[')) {
            id = `[${id}]`;
        }

        return `${START_BIT}${id}${QUERY_BIT}`;
    }

    public static rebootMessage(key: string): string {
        return `${REBOOT_BIT}${DELIMIT_BIT}${key}`;
    }

    public static initializeSettingsMessage(key: string): string {
        return `${INIT_BIT}${DELIMIT_BIT}${key}`;
    }

    public static buzzMessage(key: string): string {
        return `${BUZZ_BIT}${DELIMIT_BIT}${key}`;
    }

    public static updateSettingMessage(setting: string, value: string, key: string): string {
        return `${UPDATE_SETTING_BIT}${setting}@${value}${DELIMIT_BIT}${key}`;
    }

    public static loginMessage(password: string, key: string): string {
        return `${LOGIN_BIT}${password}${DELIMIT_BIT}${key}`;
    }

    public static getMacAddress(buffer: Buffer): string | null {
        const message = buffer.toString();
        const matches = message.match(MAC_REGEX);

        if (!!matches && matches.length > 0) {
            return matches[0];
        }

        return null;
    }

    public static iterateSend(socket: SocketAsPromised, setting: Buffer, ipAddress: string, port: number): Promise<boolean> {
        return new Promise(resolve => {
            socket.send(setting, 0, setting.length, port, ipAddress)
                .then(() => socket.recv())
                .then((packet) => resolve(this.processSettingResponse(packet)))
        })
    }

    public static checkIfDenied(packet?: IncomingPacket): boolean {
        if (!packet) {
            return false
        }

        const message = packet.msg.toString();

        return message === `${DENY_BIT}${DELIMIT_BIT}` || message === DENY_BIT;
    }


}
