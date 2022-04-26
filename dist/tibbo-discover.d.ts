#! /usr/bin/env node
import { TibboDevice } from "./tibbo-types";
export declare class TibboDiscover {
    private devices;
    private activeSockets;
    private _debug;
    get debug(): boolean;
    set debug(debug: boolean);
    scan(timeout?: number): Promise<TibboDevice[]>;
    query(id: string, timeout?: number): Promise<TibboDevice | null>;
    stop(): Promise<TibboDevice[]>;
    private sendBroadcastMessage;
    private debugPrint;
}
