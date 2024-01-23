import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big, BigSource } from '../index.js';
import { FasterMovingAverageTypes, MovingAverageTypes } from '../MA/MovingAverageTypes.js';
export declare class StochasticRSI extends BigIndicatorSeries {
    readonly interval: number;
    private readonly period;
    private readonly rsi;
    constructor(interval: number, SmoothingIndicator?: MovingAverageTypes);
    update(price: BigSource): void | Big;
}
export declare class FasterStochasticRSI extends NumberIndicatorSeries {
    readonly interval: number;
    private readonly period;
    private readonly rsi;
    constructor(interval: number, SmoothingIndicator?: FasterMovingAverageTypes);
    update(price: number): void | number;
}
