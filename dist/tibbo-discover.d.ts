#! /usr/bin/env node
import { TibboDevice, TibboDeviceLoginResponse, TibboDeviceSetting, TibboDeviceUpdateSettingResponse } from "./tibbo-types";
export declare class TibboDiscover {
    private devices;
    private activeSockets;
    private readonly key;
    constructor(key?: string);
    scan(timeout?: number): Promise<TibboDevice[]>;
    query(id: string, timeout?: number): Promise<TibboDevice | null>;
    stop(): Promise<TibboDevice[]>;
    login(ipAddress: string, password: string, key?: string): Promise<TibboDeviceLoginResponse>;
    buzz(ipAddress: string, password: string, key?: string): Promise<unknown>;
    reboot(ipAddress: string, password: string, key?: string): Promise<unknown>;
    updateSetting(setting: string, value: string, ipAddress: string, password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse>;
    updateSettings(settings: TibboDeviceSetting[], ipAddress: string, password: string): Promise<TibboDeviceUpdateSettingResponse[] | TibboDeviceLoginResponse>;
    private sendBroadcastMessage;
    private sendSingleAuthMessage;
}
