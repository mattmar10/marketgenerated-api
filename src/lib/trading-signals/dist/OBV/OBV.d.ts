import { Big } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { OpenHighLowCloseVolume, OpenHighLowCloseVolumeNumber } from '../util/index.js';
export declare class OBV extends BigIndicatorSeries<OpenHighLowCloseVolume> {
    readonly candles: OpenHighLowCloseVolume[];
    update(candle: OpenHighLowCloseVolume): Big | void;
}
export declare class FasterOBV extends NumberIndicatorSeries<OpenHighLowCloseVolumeNumber> {
    readonly candles: OpenHighLowCloseVolumeNumber[];
    update(candle: OpenHighLowCloseVolumeNumber): void | number;
}
