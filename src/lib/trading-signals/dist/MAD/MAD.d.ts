import { Big, BigSource } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
export declare class MAD extends BigIndicatorSeries {
    readonly interval: number;
    readonly prices: BigSource[];
    constructor(interval: number);
    update(price: BigSource): void | Big;
    static getResultFromBatch(prices: BigSource[], average?: BigSource): Big;
}
export declare class FasterMAD extends NumberIndicatorSeries {
    readonly interval: number;
    readonly prices: number[];
    constructor(interval: number);
    update(price: number): void | number;
    static getResultFromBatch(prices: number[], average?: number): number;
}
