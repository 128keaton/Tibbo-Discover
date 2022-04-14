import {TibboHelpers} from "../dist";
import {Buffer} from "buffer";
import {IncomingPacket} from "dgram-as-promised";


test('#testInstances', () => {
    expect(TibboHelpers.processQueryResponse).toBeInstanceOf(Function);
    expect(TibboHelpers.processLoginResponse).toBeInstanceOf(Function);
    expect(TibboHelpers.processSettingResponse).toBeInstanceOf(Function);
    expect(TibboHelpers.queryMessage).toBeInstanceOf(Function);
    expect(TibboHelpers.getMacAddress).toBeInstanceOf(Function);
    expect(TibboHelpers.iterateSend).toBeInstanceOf(Function);
});


test('#testProcessQueryResponse', () => {
    const id = '[000.036.119.087.075.146]'
    const board = 'TPP2W(G2)-4.00.01';
    const application = 'SensorControl';
    const ipAddress ='0.0.0.0';

    const fakeMsg = `${id}A<${board}>/6779e0bc-2a25-4bab-aa38-c40a5d3b7432/${application}`;
    const fakePacket = {msg: Buffer.from(fakeMsg), rinfo: {address: ipAddress}};

    expect(TibboHelpers.processQueryResponse(id, fakePacket as IncomingPacket)).toEqual({
        board, application, ipAddress, id
    });

    expect(TibboHelpers.processQueryResponse(id, undefined)).toBeNull();
});

test('#testProcessLoginResponse', () => {
    const ipAddress ='0.0.0.0';

    const successPacket = {msg: Buffer.from('A'), rinfo: {address: ipAddress}};
    const errorPacket = {msg: Buffer.from('D'), rinfo: {address: ipAddress}};

    expect(TibboHelpers.processLoginResponse(successPacket as IncomingPacket)).toEqual(true);
    expect(TibboHelpers.processLoginResponse(errorPacket as IncomingPacket)).toEqual(false);
    expect(TibboHelpers.processLoginResponse(undefined)).toBeNull();
});

test('#testProcessSettingResponse', () => {
    const ipAddress ='0.0.0.0';

    const successPacket = {msg: Buffer.from('A'), rinfo: {address: ipAddress}};
    const errorPacket = {msg: Buffer.from('D'), rinfo: {address: ipAddress}};

    expect(TibboHelpers.processSettingResponse(successPacket as IncomingPacket)).toEqual(true);
    expect(TibboHelpers.processSettingResponse(errorPacket as IncomingPacket)).toEqual(false);
    expect(TibboHelpers.processSettingResponse(undefined)).toEqual(false);
});

test('#testQueryMessage', () => {
    const validID = '[000.036.119.087.075.146]';
    const invalidID = '000.036.119.087.075.146';

    expect(TibboHelpers.queryMessage(validID)).toEqual(`_${validID}X`);
    expect(TibboHelpers.queryMessage(invalidID)).toEqual(`_${validID}X`);
});

test('#testGetMacAddress', () => {
    const id = '[000.036.119.087.075.146]';
    const bufferID = Buffer.from(id);

    const invalidID = '000.036.119.087.075.146';
    const invalidBufferID = Buffer.from(invalidID);

    expect(TibboHelpers.getMacAddress(bufferID)).toEqual(id);
    expect(TibboHelpers.getMacAddress(invalidBufferID)).toBeNull();
});
