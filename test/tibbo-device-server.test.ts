import {TibboDeviceSetting} from "../dist";
import {TibboDeviceServer} from "../src";


test('#testInstances', () => {
    const deviceServer = new TibboDeviceServer();

    expect(deviceServer.stop).toBeInstanceOf(Function);
    expect(deviceServer.login).toBeInstanceOf(Function);
    expect(deviceServer.buzz).toBeInstanceOf(Function);
    expect(deviceServer.reboot).toBeInstanceOf(Function);
    expect(deviceServer.initializeSettings).toBeInstanceOf(Function);
    expect(deviceServer.updateSetting).toBeInstanceOf(Function);
    expect(deviceServer.updateSettings).toBeInstanceOf(Function);

    // @ts-ignore
    expect(deviceServer.sendSingleAuthMessage).toBeInstanceOf(Function);
});

test('#testKey', () => {
    const customKey = 'apple123';
    const deviceServer = new TibboDeviceServer();
    const deviceServerCustom = new TibboDeviceServer(customKey);

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
    const fakeResponse = {key: 'tibbo123', message: 'ERR_TIMEOUT', success: false};

    return deviceServer.login('0.0.0.0', 'password').then(response => {
        expect(response).toEqual(fakeResponse);
    });
});

test('#testUpdateSetting', () => {
    const deviceServer = new TibboDeviceServer();
    const fakeResponse = {key: 'tibbo123', message: 'ERR_TIMEOUT', success: false};

    return deviceServer.updateSetting('API', '12345', '0.0.0.0', 'password').then(response => {
        expect(response).toEqual(fakeResponse);
    });
});

test('#testUpdateSettings', () => {
    const deviceServer = new TibboDeviceServer();
    const fakeResponse = {key: 'tibbo123', message: 'ERR_TIMEOUT', success: false};
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

test('#testInitializeSettings', () => {
    const deviceServer = new TibboDeviceServer();

    return deviceServer.initializeSettings('0.0.0.0', 'password').then(result => {
        expect(result).toBeTruthy();
    })
});

