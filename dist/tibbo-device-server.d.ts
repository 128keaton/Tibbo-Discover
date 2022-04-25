import { TibboDeviceLoginResponse, TibboDeviceSetting, TibboDeviceUpdateSettingResponse } from "./tibbo-types";
export declare class TibboDeviceServer {
    private activeSockets;
    private readonly key;
    constructor(key?: string);
    login(ipAddress: string, password: string, key?: string): Promise<TibboDeviceLoginResponse>;
    buzz(ipAddress: string, password: string, key?: string): Promise<unknown>;
    reboot(ipAddress: string, password: string, key?: string): Promise<unknown>;
    raw(ipAddress: string, password: string, message: string, key?: string): Promise<unknown>;
    initializeSettings(ipAddress: string, password: string, key?: string): Promise<unknown>;
    updateSetting(setting: string, value: string, ipAddress: string, password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse>;
    updateSettings(settings: TibboDeviceSetting[], ipAddress: string, password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse>;
    stop(): Promise<void>;
    private sendSingleAuthMessage;
}
