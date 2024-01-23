import { Big, BigSource } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { FasterMovingAverageTypes, MovingAverageTypes } from '../MA/MovingAverageTypes.js';
export declare class RSI extends BigIndicatorSeries {
    readonly interval: number;
    private previousPrice?;
    private readonly avgGain;
    private readonly avgLoss;
    private readonly maxValue;
    constructor(interval: number, SmoothingIndicator?: MovingAverageTypes);
    update(price: BigSource): void | Big;
}
export declare class FasterRSI extends NumberIndicatorSeries {
    readonly interval: number;
    private previousPrice?;
    private readonly avgGain;
    private readonly avgLoss;
    private readonly maxValue;
    constructor(interval: number, SmoothingIndicator?: FasterMovingAverageTypes);
    update(price: number): void | number;
}
