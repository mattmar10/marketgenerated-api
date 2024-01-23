import { Big, BigSource } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
export declare class ROC extends BigIndicatorSeries {
    readonly interval: number;
    readonly prices: Big[];
    constructor(interval: number);
    update(price: BigSource): Big | void;
}
export declare class FasterROC extends NumberIndicatorSeries {
    readonly interval: number;
    readonly prices: number[];
    constructor(interval: number);
    update(price: number): void | number;
}
