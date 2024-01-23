import { Big } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { HighLowClose, HighLowCloseNumber } from '../util/index.js';
export declare class TR extends BigIndicatorSeries<HighLowClose> {
    private previousCandle?;
    update(candle: HighLowClose): Big;
}
export declare class FasterTR extends NumberIndicatorSeries<HighLowCloseNumber> {
    private previousCandle?;
    update(candle: HighLowCloseNumber): number;
}
