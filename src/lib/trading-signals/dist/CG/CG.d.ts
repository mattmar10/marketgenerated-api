import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big, BigSource } from '../index.js';
import { FasterSMA, SMA } from '../SMA/SMA.js';
export declare class CG extends BigIndicatorSeries {
    readonly interval: number;
    readonly signalInterval: number;
    signal: SMA;
    readonly prices: Big[];
    get isStable(): boolean;
    constructor(interval: number, signalInterval: number);
    update(price: BigSource): void | Big;
}
export declare class FasterCG extends NumberIndicatorSeries {
    readonly interval: number;
    readonly signalInterval: number;
    signal: FasterSMA;
    readonly prices: number[];
    get isStable(): boolean;
    constructor(interval: number, signalInterval: number);
    update(price: number): void | number;
}
