import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big, BigSource } from '../index.js';
import { HighLowClose, HighLowCloseNumber } from '../util/index.js';
export declare class CCI extends BigIndicatorSeries<HighLowClose> {
    readonly interval: number;
    readonly prices: BigSource[];
    private readonly sma;
    private readonly typicalPrices;
    constructor(interval: number);
    update(candle: HighLowClose): void | Big;
    private cacheTypicalPrice;
}
export declare class FasterCCI extends NumberIndicatorSeries<HighLowCloseNumber> {
    readonly interval: number;
    readonly prices: number[];
    private readonly sma;
    private readonly typicalPrices;
    constructor(interval: number);
    update(candle: HighLowCloseNumber): void | number;
    private cacheTypicalPrice;
}
