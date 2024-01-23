import { Big } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { FasterMovingAverageTypes, MovingAverageTypes } from '../MA/MovingAverageTypes.js';
import { HighLowClose, HighLowCloseNumber } from '../util/index.js';
export declare class ATR extends BigIndicatorSeries<HighLowClose> {
    readonly interval: number;
    private readonly tr;
    private readonly smoothing;
    constructor(interval: number, SmoothingIndicator?: MovingAverageTypes);
    update(candle: HighLowClose): Big | void;
}
export declare class FasterATR extends NumberIndicatorSeries<HighLowCloseNumber> {
    readonly interval: number;
    private readonly tr;
    private readonly smoothing;
    constructor(interval: number, SmoothingIndicator?: FasterMovingAverageTypes);
    update(candle: HighLowCloseNumber): number | void;
}
