import {TibboDiscover} from "../dist";
import {TibboDeviceServer} from "../src";


test('#testInstances', () => {
    const discover = new TibboDiscover();

    expect(discover.scan).toBeInstanceOf(Function);
    expect(discover.query).toBeInstanceOf(Function);
    expect(discover.stop).toBeInstanceOf(Function);


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


test('#testDebugPrinting', () => {
    const discover = new TibboDiscover();

    expect(discover.debug).toBe(false);
    discover.debug = true;
    expect(discover.debug).toBe(true);

    // @ts-ignore
    expect(discover.debugPrint('success', 'success')).toBeUndefined();
});
