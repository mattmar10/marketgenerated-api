import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big, BigSource } from '../index.js';
export declare class MOM extends BigIndicatorSeries {
    readonly interval: number;
    private readonly history;
    private readonly historyLength;
    constructor(interval: number);
    update(value: BigSource): void | Big;
}
export declare class FasterMOM extends NumberIndicatorSeries {
    readonly interval: number;
    private readonly history;
    private readonly historyLength;
    constructor(interval: number);
    update(value: number): void | number;
}
