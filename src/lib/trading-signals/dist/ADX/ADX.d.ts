import { Big } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { HighLowClose, HighLowCloseNumber } from '../util/HighLowClose.js';
import { FasterMovingAverageTypes, MovingAverageTypes } from '../MA/MovingAverageTypes.js';
export declare class ADX extends BigIndicatorSeries<HighLowClose> {
    readonly interval: number;
    private readonly dx;
    private readonly adx;
    constructor(interval: number, SmoothingIndicator?: MovingAverageTypes);
    get mdi(): Big | void;
    get pdi(): Big | void;
    update(candle: HighLowClose): Big | void;
}
export declare class FasterADX extends NumberIndicatorSeries<HighLowCloseNumber> {
    readonly interval: number;
    private readonly dx;
    private readonly adx;
    constructor(interval: number, SmoothingIndicator?: FasterMovingAverageTypes);
    get mdi(): number | void;
    get pdi(): number | void;
    update(candle: HighLowCloseNumber): void | number;
}
