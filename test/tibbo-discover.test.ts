import {lastValueFrom, Observable} from "rxjs";
import {TibboDiscover} from "../dist/tibbo-discover";


test('#testInstances', () => {
    const instance = new TibboDiscover();

    expect(instance).toBeInstanceOf(TibboDiscover);
    expect(instance.devices).toBeInstanceOf(Observable);
    expect(instance.stop).toBeInstanceOf(Function);
});

test('#testValues', () => {
    const instanceA = new TibboDiscover();
    const instanceB = new TibboDiscover(6000);

    // @ts-ignore
    expect(instanceA._scanTimeout).toEqual(5000);

    // @ts-ignore
    expect(instanceB._scanTimeout).toEqual(6000);
});

jest.setTimeout(25000);
test('#checkArray', async () => {
    const instance = new TibboDiscover();

    await instance.scan(1);

    const devices = await lastValueFrom(instance.devices);

    expect(devices).toBeInstanceOf(Array);

    await instance.stop();
});


test('#checkBadClient', async () => {
    const instance = new TibboDiscover();

    // @ts-ignore
    instance._currentClient = undefined;

    try {
        await instance.scan()
    } catch (e) {
        return expect(e).toEqual('dgram client not available')
    }

    try {
        // @ts-ignore
        await instance.send('BAD');
    } catch (e) {
        expect(e).toBeInstanceOf(Error);
    }

    await instance.stop();
});

test('#checkDoubleBound', async () => {
    const instance = new TibboDiscover();

    // @ts-ignore
    await instance.setupClient(instance._currentClient);

    // @ts-ignore
    expect(instance._isBound).toBe(true);

    // @ts-ignore
    await instance.setupClient(instance._currentClient);

    // @ts-ignore
    expect(instance._isBound).toBe(true);

    await instance.stop();

    // @ts-ignore
    expect(instance._isBound).toBe(false);
});


test('#reboot', async () => {
    const instanceA = new TibboDiscover();

    expect.assertions(1);

    try {
        await instanceA.reboot('0.0.0.0')
    } catch (e) {
        return expect(e).toStrictEqual(Error('Could not find device'))
    }

    const instanceB = new TibboDiscover();

    // @ts-ignore
    instanceB._currentClient.close();

    // @ts-ignore
    instanceB._currentClient = undefined;

    expect.assertions(1);

    try {
        await instanceB.reboot('0.0.0.0')
    } catch (e) {
        return expect(e).toStrictEqual(Error('Could not find device'))
    }

    const instanceC = new TibboDiscover();

    expect.assertions(1);

    // @ts-ignore
    instanceC.$devices.next([{
        boardType: 'dummy',
        currentApp: 'dummy',
        data: '1234',
        address: '1234',
        id: '1234',
        macAddress: '0000'
    }]);

    const rebooted = await instanceB.reboot('1234');
    expect(rebooted).toEqual(true);

    await instanceA.stop();
    await instanceB.stop();
    await instanceC.stop();
});

test('#stop', async () => {
    const instance = new TibboDiscover();

    // @ts-ignore
    instance._currentClient = undefined;

    try {
        await instance.stop();
    } catch (e) {
        return expect(e).toStrictEqual(Error('dgram client not available'))
    }
});

test('#send', async () => {
    const instance = new TibboDiscover();

    // @ts-ignore
    instance._currentClient = undefined;
    expect.assertions(1);

    try {
        // @ts-ignore
       await instance.send('asd')
    } catch (e) {
        return expect(e).toStrictEqual(Error('dgram client not available'))
    }
});
