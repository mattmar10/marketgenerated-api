import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { HighLowClose, HighLowCloseNumber } from '../util/index.js';
import { Big } from '../index.js';
import { FasterMovingAverageTypes, MovingAverageTypes } from '../MA/MovingAverageTypes.js';
export declare class DX extends BigIndicatorSeries<HighLowClose> {
    readonly interval: number;
    private readonly movesUp;
    private readonly movesDown;
    private previousCandle?;
    private readonly atr;
    mdi?: Big;
    pdi?: Big;
    constructor(interval: number, SmoothingIndicator?: MovingAverageTypes);
    private updateState;
    update(candle: HighLowClose): Big | void;
}
export declare class FasterDX extends NumberIndicatorSeries<HighLowCloseNumber> {
    readonly interval: number;
    private readonly movesUp;
    private readonly movesDown;
    private previousCandle?;
    private readonly atr;
    mdi?: number;
    pdi?: number;
    constructor(interval: number, SmoothingIndicator?: FasterMovingAverageTypes);
    private updateState;
    update(candle: HighLowCloseNumber): number | void;
}
