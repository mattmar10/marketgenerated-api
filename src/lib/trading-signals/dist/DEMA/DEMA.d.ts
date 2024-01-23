import { Big, BigSource } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
export declare class DEMA extends BigIndicatorSeries {
    readonly interval: number;
    private readonly inner;
    private readonly outer;
    constructor(interval: number);
    update(price: BigSource): Big;
    get isStable(): boolean;
}
export declare class FasterDEMA extends NumberIndicatorSeries {
    readonly interval: number;
    private readonly inner;
    private readonly outer;
    constructor(interval: number);
    update(price: number): number;
    get isStable(): boolean;
}
