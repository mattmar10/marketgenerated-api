import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big } from '../index.js';
import { HighLow, HighLowNumber } from '../util/index.js';
import { FasterMovingAverageTypes, MovingAverageTypes } from '../MA/MovingAverageTypes.js';
import { FasterMovingAverage, MovingAverage } from '../MA/MovingAverage.js';
export declare class AO extends BigIndicatorSeries<HighLow> {
    readonly shortInterval: number;
    readonly longInterval: number;
    readonly long: MovingAverage;
    readonly short: MovingAverage;
    constructor(shortInterval: number, longInterval: number, SmoothingIndicator?: MovingAverageTypes);
    update({ low, high }: HighLow): void | Big;
}
export declare class FasterAO extends NumberIndicatorSeries<HighLowNumber> {
    readonly shortInterval: number;
    readonly longInterval: number;
    readonly long: FasterMovingAverage;
    readonly short: FasterMovingAverage;
    constructor(shortInterval: number, longInterval: number, SmoothingIndicator?: FasterMovingAverageTypes);
    update({ low, high }: HighLowNumber): void | number;
}
