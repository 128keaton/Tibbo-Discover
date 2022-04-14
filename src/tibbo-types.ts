export interface TibboDevice {
    board: string;
    application: string;
    ipAddress: string;
    id: string
}

export interface TibboDeviceLoginResponse {
    key: string
    success: boolean;
    message?: string;
}

export interface TibboDeviceSetting {
    settingName: string;
    settingValue: string;
}

export interface TibboDeviceUpdateSettingResponse {
    success: boolean;
    setting: TibboDeviceSetting;
}
