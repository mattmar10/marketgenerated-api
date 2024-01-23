import { Big, BigSource } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
export declare abstract class MovingAverage extends BigIndicatorSeries {
    readonly interval: number;
    constructor(interval: number);
    updates(prices: BigSource[]): Big | void;
    abstract update(price: BigSource): Big | void;
}
export declare abstract class FasterMovingAverage extends NumberIndicatorSeries {
    readonly interval: number;
    constructor(interval: number);
    updates(prices: number[]): number | void;
    abstract update(price: number): number | void;
}
