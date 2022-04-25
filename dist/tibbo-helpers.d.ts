/// <reference types="node" />
import { IncomingPacket, SocketAsPromised } from "dgram-as-promised";
import { Buffer } from "buffer";
import { TibboDevice } from "./tibbo-types";
export declare class TibboHelpers {
    static get discoverMessage(): string;
    static processQueryResponse(id: string, packet?: IncomingPacket): TibboDevice | null;
    static processLoginResponse(packet?: IncomingPacket): boolean | null;
    static processSettingResponse(packet?: IncomingPacket): boolean;
    static queryMessage(id: string): string;
    static rebootMessage(key: string): string;
    static rawMessage(rawMessage: string, key: string): string;
    static getSettingMessage(setting: string, key: string): string;
    static initializeSettingsMessage(key: string): string;
    static buzzMessage(key: string): string;
    static updateSettingMessage(setting: string, value: string, key: string): string;
    static loginMessage(password: string, key: string): string;
    static getMacAddress(buffer: Buffer): string | null;
    static stripSettingsResponse(key: string, rawResponse?: {
        data?: string;
    }): string | null;
    static iterateSend(socket: SocketAsPromised, setting: Buffer, ipAddress: string, port: number): Promise<boolean>;
    static checkIfDenied(packet?: IncomingPacket): boolean;
}
