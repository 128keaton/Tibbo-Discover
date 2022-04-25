import { TibboDeviceLoginResponse, TibboDeviceSetting, TibboDeviceUpdateSettingResponse } from "./tibbo-types";
export declare class TibboDeviceServer {
    private activeSockets;
    private readonly key;
    constructor(key?: string);
    login(ipAddress: string, password: string, key?: string, timeout?: number): Promise<TibboDeviceLoginResponse>;
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
    private static handleTimeout;
    private appendSocket;
    private handleLoginResponse;
    private setupLoginTimeout;
    private setupTimeout;
    private sendSingleAuthMessage;
    private static handleGenericPacket;
    private static handleDenied;
}
