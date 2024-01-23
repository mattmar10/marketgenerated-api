import { BandsResult, FasterBandsResult } from '../util/BandsResult.js';
import { Indicator } from '../Indicator.js';
import { FasterMovingAverageTypes, MovingAverageTypes } from '../MA/MovingAverageTypes.js';
import { HighLowClose, HighLowCloseNumber } from '../util/index.js';
export declare class AccelerationBands implements Indicator<BandsResult, HighLowClose> {
    readonly interval: number;
    readonly width: number;
    private readonly lowerBand;
    private readonly middleBand;
    private readonly upperBand;
    constructor(interval: number, width: number, SmoothingIndicator?: MovingAverageTypes);
    get isStable(): boolean;
    update({ high, low, close }: HighLowClose): void;
    getResult(): BandsResult;
}
export declare class FasterAccelerationBands implements Indicator<FasterBandsResult, HighLowCloseNumber> {
    readonly interval: number;
    readonly width: number;
    private readonly lowerBand;
    private readonly middleBand;
    private readonly upperBand;
    constructor(interval: number, width: number, SmoothingIndicator?: FasterMovingAverageTypes);
    update({ high, low, close }: HighLowCloseNumber): void;
    get isStable(): boolean;
    getResult(): FasterBandsResult;
}
