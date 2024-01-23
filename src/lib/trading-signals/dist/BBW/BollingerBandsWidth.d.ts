import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big, BigSource } from '../index.js';
import { BollingerBands, FasterBollingerBands } from '../BBANDS/BollingerBands.js';
export declare class BollingerBandsWidth extends BigIndicatorSeries {
    readonly bollingerBands: BollingerBands;
    constructor(bollingerBands: BollingerBands);
    update(price: BigSource): void | Big;
}
export declare class FasterBollingerBandsWidth extends NumberIndicatorSeries {
    readonly bollingerBands: FasterBollingerBands;
    constructor(bollingerBands: FasterBollingerBands);
    update(price: number): void | number;
}
