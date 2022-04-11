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

    const instanceC = new TibboDiscover();
    instanceC.scan(1000);

    // @ts-ignore
    expect(instanceC._scanTimeout).toEqual(1000);

    const instanceD = new TibboDiscover();
    instanceD.scan(0);

    // @ts-ignore
    expect(instanceD._scanTimeout).toEqual(3000);
});

jest.setTimeout(25000);
test('#checkArray', async () => {
    const instance = new TibboDiscover();

    const devices = await instance.scan(1);

    expect(devices).toBeInstanceOf(Array);

    await instance.stop();
});

test('#sendMessage', async () => {
    const instance = new TibboDiscover(1000);
    const ipAddress = '0.0.0.0';

    try {
        await instance.sendMessage(ipAddress, 'X', true);
    } catch (e) {
        expect(e).toEqual(`Could not find device ${ipAddress}`)
    }

    await instance.stop();
});

test('#checkErrors',  () => {
    const address = '0.0.0.0';
    const client = '[000.036.119.087.075.124]'

    const instanceA = new TibboDiscover(1000);
    const instanceB = new TibboDiscover(1000);
    const instanceC = new TibboDiscover(1000);

    const messageA = `${client}C`;
    const messageB = `${client}R`;
    const messageC = `${client}F`;

    // @ts-ignore
    instanceA.processMessage(messageA, {address});

    // @ts-ignore
    expect(instanceA._errors[client]).toEqual('C');

    // @ts-ignore
    instanceB.processMessage(messageB, {address});

    // @ts-ignore
    expect(instanceB._errors[client]).toEqual('R');

    // @ts-ignore
    instanceC.processMessage(messageC, {address});

    // @ts-ignore
    expect(instanceC._errors[client]).toEqual('F');
});


test('#checkFallthru',  () => {
    const address = '0.0.0.0';
    const client = '[000.036.119.087.075.124]'

    const instance = new TibboDiscover(1000);
    const message = `${client}Z`;


    // @ts-ignore
    instance.processMessage(message, {address});

    // @ts-ignore
    expect(instance._messages[client]).toEqual('Z');
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
