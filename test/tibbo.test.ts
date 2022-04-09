
import {lastValueFrom, Observable} from "rxjs";
import {TibboDiscover} from "../dist";


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

    instance.scan();

    const devices = await lastValueFrom(instance.devices);

    expect(devices).toBeInstanceOf(Array);
});


test('#checkBadClient',  () => {
    const instance = new TibboDiscover();

    // @ts-ignore
    instance._currentClient = undefined;

    expect(() => {
        instance.scan()
    }).toThrow('dgram client not available');

    expect(() => {
        instance.stop()
    }).toThrow('dgram client not available');

    expect(() => {
        // @ts-ignore
        instance.send('BAD');
    }).toThrow('dgram client not available');
});

test('#checkDoubleBound',  async () => {
    const instance = new TibboDiscover();

    // @ts-ignore
    await instance.setupClient(instance._currentClient);

    // @ts-ignore
    expect(instance._isBound).toBe(true);

    // @ts-ignore
    await instance.setupClient(instance._currentClient);

    // @ts-ignore
    expect(instance._isBound).toBe(true);

    instance.stop();

    // @ts-ignore
    expect(instance._isBound).toBe(false);
});
