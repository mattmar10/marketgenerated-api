import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { AO, FasterAO } from '../AO/AO.js';
import { FasterSMA, SMA } from '../SMA/SMA.js';
import { FasterMOM, MOM } from '../MOM/MOM.js';
import { HighLow, HighLowNumber } from '../util/index.js';
import { Big } from '../index.js';
export declare class AC extends BigIndicatorSeries<HighLow> {
    readonly shortAO: number;
    readonly longAO: number;
    readonly signalInterval: number;
    readonly ao: AO;
    readonly momentum: MOM;
    readonly signal: SMA;
    constructor(shortAO: number, longAO: number, signalInterval: number);
    update(input: HighLow): void | Big;
}
export declare class FasterAC extends NumberIndicatorSeries<HighLowNumber> {
    readonly shortAO: number;
    readonly longAO: number;
    readonly signalInterval: number;
    readonly ao: FasterAO;
    readonly momentum: FasterMOM;
    readonly signal: FasterSMA;
    constructor(shortAO: number, longAO: number, signalInterval: number);
    update(input: HighLowNumber): void | number;
}
