import {TibboDeviceSetting} from "../dist";
import {TibboDeviceServer} from "../src";


test('#testInstances', () => {
    const deviceServer = new TibboDeviceServer();

    expect(deviceServer.stop).toBeInstanceOf(Function);
    expect(deviceServer.login).toBeInstanceOf(Function);
    expect(deviceServer.buzz).toBeInstanceOf(Function);
    expect(deviceServer.reboot).toBeInstanceOf(Function);
    expect(deviceServer.raw).toBeInstanceOf(Function);
    expect(deviceServer.readSetting).toBeInstanceOf(Function);
    expect(deviceServer.initializeSettings).toBeInstanceOf(Function);
    expect(deviceServer.updateSetting).toBeInstanceOf(Function);
    expect(deviceServer.updateSettings).toBeInstanceOf(Function);

    // @ts-ignore
    expect(deviceServer.sendSingleAuthMessage).toBeInstanceOf(Function);

    // @ts-ignore
    expect(deviceServer.debugPrint).toBeInstanceOf(Function);
});

test('#testKey', () => {
    const customKey = 'apple123';
    const deviceServer = new TibboDeviceServer();
    const deviceServerCustom = new TibboDeviceServer(false, customKey);

    // @ts-ignore
    expect(deviceServer.key).toEqual('tibbo123');

    // @ts-ignore
    expect(deviceServerCustom.key).toEqual(customKey);
});


test('#testStop', () => {
    const deviceServer = new TibboDeviceServer();

    return deviceServer.stop().then(result => {
        expect(result).toBeUndefined()
    })
});

test('#testLogin', () => {
    const deviceServer = new TibboDeviceServer();
    const fakeResponse = {key: 'tibbo123', message: 'ERR_SOCKET_DGRAM_NOT_RUNNING', success: false};

    return deviceServer.login('0.0.0.0', 'password').then(response => {
        expect(response).toEqual(fakeResponse);
    });
});

test('#testUpdateSetting', () => {
    const deviceServer = new TibboDeviceServer();
    const fakeResponse = {key: 'tibbo123', message: 'ERR_SOCKET_DGRAM_NOT_RUNNING', success: false};

    return deviceServer.updateSetting('API', '12345', '0.0.0.0', 'password').then(response => {
        expect(response).toEqual(fakeResponse);
    });
});

test('#testUpdateSettings', () => {
    const deviceServer = new TibboDeviceServer();
    const fakeResponse = {key: 'tibbo123', message: 'ERR_SOCKET_DGRAM_NOT_RUNNING', success: false};
    const settings: TibboDeviceSetting[] = [
        {
            settingName: 'API',
            settingValue: '12345'
        }
    ];

    return deviceServer.updateSettings(settings, '0.0.0.0', 'password').then(response => {
        expect(response).toEqual(fakeResponse);
    });
});

test('#testReboot', () => {
    const deviceServer = new TibboDeviceServer();

    return deviceServer.reboot('0.0.0.0', 'password').then(result => {
        expect(result).toBeTruthy();
    })
});

test('#testBuzz', () => {
    const deviceServer = new TibboDeviceServer();

    return deviceServer.buzz('0.0.0.0', 'password').then(result => {
        expect(result).toBeTruthy();
    })
});

test('#testRaw', () => {
    const deviceServer = new TibboDeviceServer();

    return deviceServer.raw('0.0.0.0', 'password', 'raw').then(result => {
        expect(result).toBeTruthy();
    })
});

test('#testInitializeSettings', () => {
    const deviceServer = new TibboDeviceServer();

    return deviceServer.initializeSettings('0.0.0.0', 'password').then(result => {
        expect(result).toBeTruthy();
    })
});

test('#testDebugPrinting', () => {
    const deviceServer = new TibboDeviceServer();

    expect(deviceServer.debug).toBe(false);
    deviceServer.debug = true;
    expect(deviceServer.debug).toBe(true);

    // @ts-ignore
    expect(deviceServer.debugPrint('success', 'success')).toBeUndefined();
});

jest.setTimeout(50000);
test('#testGetSetting', () => {
    const deviceServer = new TibboDeviceServer();

    return deviceServer.readSetting('0.0.0.0', 'password', 'API').then(result => {
        expect(result).toBeNull();
    })
});


