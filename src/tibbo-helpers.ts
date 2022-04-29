import {IncomingPacket, SocketAsPromised} from "dgram-as-promised";
import {Buffer} from "buffer";
import {TibboDevice} from "./tibbo-types";
import chalk from 'chalk';

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
const RETRY_LOGIN_BIT = 'R';
const LOGOUT_BIT = 'O';
const UPDATE_SETTING_BIT = 'S';
const READ_SETTING_BIT = 'G';

// Response bits
const ERR_BIT = 'C';
const REJECT_BIT = 'R';
const FAIL_BIT = 'F';
const DENY_BIT = 'D';


export class TibboHelpers {
    public static enableDebugPrinting: boolean = false;
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

        TibboHelpers.debugPrint('info', `Raw login response: ${rawMessage}`);

        return rawMessage[0] !== DENY_BIT &&
            rawMessage[0] !== REJECT_BIT &&
            rawMessage[0] !== FAIL_BIT &&
            rawMessage[0] !== ERR_BIT;
    }

    public static isRejectResponse(packet?: IncomingPacket) {
        if (!packet) {
            return null;
        }

        const rawMessage = packet.msg.toString();

        TibboHelpers.debugPrint('info', `isRejectResponse: ${rawMessage}`);

        return rawMessage[0] === REJECT_BIT;
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

    public static rawMessage(rawMessage: string, key: string): string {
        return `${rawMessage}${DELIMIT_BIT}${key}`;
    }

    public static getSettingMessage(setting: string, key: string): string {
        return `${READ_SETTING_BIT}${setting}${DELIMIT_BIT}${key}`;
    }

    public static initializeSettingsMessage(key: string): string {
        return `${INIT_BIT}${DELIMIT_BIT}${key}`;
    }

    public static buzzMessage(key: string): string {
        return `${BUZZ_BIT}${DELIMIT_BIT}${key}`;
    }

    public static logoutMessage(key: string): string {
        return `${LOGOUT_BIT}${DELIMIT_BIT}${key}`;
    }

    public static updateSettingMessage(setting: string, value: string, key: string): string {
        return `${UPDATE_SETTING_BIT}${setting}@${value}${DELIMIT_BIT}${key}`;
    }

    public static loginMessage(password: string, key: string): string {
        return `${LOGIN_BIT}${password}${DELIMIT_BIT}${key}`;
    }

    public static retryLoginMessage(password: string, key: string): string {
        return `${RETRY_LOGIN_BIT}${password}${DELIMIT_BIT}${key}`;
    }

    public static getMacAddress(buffer: Buffer): string | null {
        const message = buffer.toString();
        const matches = message.match(MAC_REGEX);

        if (!!matches && matches.length > 0) {
            return matches[0];
        }

        return null;
    }

    public static stripSettingsResponse(key: string, rawResponse?: { data?: string }): string | null {
        if (!!rawResponse && rawResponse.data) {
            return rawResponse.data.slice(1, rawResponse.data.length).replace(`${DELIMIT_BIT}${key}`, '');
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

        return message[0] === DENY_BIT;
    }

    public static hidePassword(password: string): string {
       if (password.length > 1) {
           const halfSize = (password.length / 2);
           const sliceLength = password.length - halfSize;
           return password.slice(0, sliceLength).replace(/./g, '*') + password.slice(sliceLength)
       }

       return '*';
    }

    public static debugPrint(color: 'success' | 'info' | 'error' | 'warning' | 'none' = 'none', ...data: any[]) {
      if (this.enableDebugPrinting) {
          const log = console.log;
          const logData = chalk.magenta('[Tibbo Discover] - ') + data.join(' ');
          switch (color) {
              case 'success':
                  log(chalk.green(logData));
                  break
              case 'info':
                  log(chalk.cyanBright(logData));
                  break;
              case 'error':
                  log(chalk.redBright(logData));
                  break;
              case 'warning':
                  log(chalk.yellowBright(logData));
                  break;
              case "none":
                  log(data);
                  break;
          }
      }
    }


}
