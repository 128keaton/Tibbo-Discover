import {TibboDeviceSetting, TibboDiscover} from "../dist";


test('#testInstances', () => {
    const discover = new TibboDiscover();

    expect(discover.scan).toBeInstanceOf(Function);
    expect(discover.query).toBeInstanceOf(Function);
    expect(discover.stop).toBeInstanceOf(Function);
    expect(discover.login).toBeInstanceOf(Function);
    expect(discover.updateSetting).toBeInstanceOf(Function);
    expect(discover.updateSettings).toBeInstanceOf(Function);

    // @ts-ignore
    expect(discover.sendBroadcastMessage).toBeInstanceOf(Function);
});

test('#testScan', () => {
    const discover = new TibboDiscover();

    return discover.scan(100).then(devices => {
        expect(devices).toBeInstanceOf(Array);
    })
});

test('#testQuery', () => {
    const discover = new TibboDiscover();

    return discover.query('[000.036.119.087.075.146]').then(device => {
       if (device) {
           expect(device).toHaveProperty('board')
           expect(device).toHaveProperty('application')
       } else {
           expect(device).toBeNull();
       }

       return discover.stop();
    })
});

test('#testStop', () => {
    const discover = new TibboDiscover();

    return discover.stop().then(devices => {
        expect(devices).toBeInstanceOf(Array);
    })
});

test('#testLogin', () => {
    const discover = new TibboDiscover();
    const fakeResponse = {key: 'apple123', message: 'ERR_TIMEOUT', success: false};

    return discover.login('0.0.0.0', 'password').then(response => {
        expect(response).toEqual(fakeResponse);
    });
});

test('#testUpdateSetting', () => {
    const discover = new TibboDiscover();
    const fakeResponse = {key: 'apple123', message: 'ERR_TIMEOUT', success: false};

    return discover.updateSetting('API', '12345', '0.0.0.0', 'password').then(response => {
        expect(response).toEqual(fakeResponse);
    });
});

test('#testUpdateSettings', () => {
    const discover = new TibboDiscover();
    const fakeResponse = {key: 'apple123', message: 'ERR_TIMEOUT', success: false};
    const settings: TibboDeviceSetting[] = [
        {
            settingName: 'API',
            settingValue: '12345'
        }
    ];

    return discover.updateSettings(settings, '0.0.0.0', 'password').then(response => {
        expect(response).toEqual(fakeResponse);
    });
});
