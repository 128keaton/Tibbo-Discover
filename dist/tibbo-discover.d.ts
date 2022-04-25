#! /usr/bin/env node
import { TibboDevice } from "./tibbo-types";
export declare class TibboDiscover {
    private devices;
    private activeSockets;
    scan(timeout?: number): Promise<TibboDevice[]>;
    query(id: string, timeout?: number): Promise<TibboDevice | null>;
    stop(): Promise<TibboDevice[]>;
    private sendBroadcastMessage;
}
