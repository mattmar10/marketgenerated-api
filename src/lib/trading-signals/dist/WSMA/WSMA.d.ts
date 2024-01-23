import { Big, BigSource } from '../index.js';
import { MovingAverage } from '../MA/MovingAverage.js';
import { NumberIndicatorSeries } from '../Indicator.js';
export declare class WSMA extends MovingAverage {
    readonly interval: number;
    private readonly indicator;
    private readonly smoothingFactor;
    constructor(interval: number);
    updates(prices: BigSource[]): Big | void;
    update(price: BigSource): Big | void;
}
export declare class FasterWSMA extends NumberIndicatorSeries {
    readonly interval: number;
    private readonly indicator;
    private readonly smoothingFactor;
    constructor(interval: number);
    updates(prices: number[]): number | void;
    update(price: number): number | void;
}
