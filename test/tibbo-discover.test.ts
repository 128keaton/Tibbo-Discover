import {TibboDiscover} from "../dist/tibbo-discover";


test('#testInstances', () => {
    const instance = new TibboDiscover();

    expect(instance).toBeInstanceOf(TibboDiscover);
    expect(instance.stop).toBeInstanceOf(Function);
    expect(instance.scan).toBeInstanceOf(Function);
});

test('#testValues', () => {
    const instanceA = new TibboDiscover();
    const instanceB = new TibboDiscover(6000);

    // @ts-ignore
    expect(instanceA._scanTimeout).toEqual(3000);

    // @ts-ignore
    expect(instanceB._scanTimeout).toEqual(6000);
});

jest.setTimeout(25000);
test('#checkArray', async () => {
    const instance = new TibboDiscover();

    const devices = await instance.scan(1);

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

jest.setTimeout(95000);
test('#reboot', async () => {
    const instance = new TibboDiscover(1000);
    const ipAddress = '0.0.0.0';

    try {
        await instance.reboot(ipAddress)
    } catch (e) {
        expect(e).toEqual(`Could not find device ${ipAddress}`)
    }

    await instance.stop();
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
