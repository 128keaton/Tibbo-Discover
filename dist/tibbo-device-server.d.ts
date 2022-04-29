import { TibboDeviceLoginResponse, TibboDeviceSetting, TibboDeviceUpdateSettingResponse } from "./tibbo-types";
import { SocketAsPromised } from "dgram-as-promised";
export declare class TibboDeviceServer {
    private activeSockets;
    private _debug;
    private readonly key;
    get debug(): boolean;
    set debug(debug: boolean);
    constructor(debug?: boolean, key?: string);
    login(ipAddress: string, password: string, key?: string, timeout?: number, passedSocket?: SocketAsPromised): Promise<TibboDeviceLoginResponse>;
    buzz(ipAddress: string, password: string, key?: string): Promise<{
        message?: any;
        data?: any;
    }>;
    reboot(ipAddress: string, password: string, key?: string): Promise<{
        message?: any;
        data?: any;
    }>;
    raw(ipAddress: string, password: string, message: string, key?: string): Promise<{
        message?: any;
        data?: any;
    }>;
    readSetting(ipAddress: string, password: string, setting: string, key?: string): Promise<string | null>;
    initializeSettings(ipAddress: string, password: string, key?: string): Promise<{
        message?: any;
        data?: any;
    }>;
    updateSetting(setting: string, value: string, ipAddress: string, password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse>;
    updateSettings(settings: TibboDeviceSetting[], ipAddress: string, password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse>;
    stop(): Promise<void>;
    private logout;
    private static handleTimeout;
    private appendSocket;
    private handleLoginResponse;
    private setupLoginTimeout;
    private setupTimeout;
    private sendSingleAuthMessage;
    private debugPrint;
    private static handleGenericPacket;
    private static handleDenied;
}
