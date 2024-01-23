import { Big, BigSource } from '../index.js';
import { BandsResult, FasterBandsResult } from '../util/BandsResult.js';
import { Indicator } from '../Indicator.js';
export declare class BollingerBands implements Indicator<BandsResult> {
    readonly interval: number;
    readonly deviationMultiplier: number;
    readonly prices: Big[];
    private result;
    constructor(interval: number, deviationMultiplier?: number);
    get isStable(): boolean;
    update(price: BigSource): void | BandsResult;
    getResult(): BandsResult;
}
export declare class FasterBollingerBands implements Indicator<FasterBandsResult> {
    readonly interval: number;
    readonly deviationMultiplier: number;
    readonly prices: number[];
    private result;
    constructor(interval: number, deviationMultiplier?: number);
    update(price: number): void | FasterBandsResult;
    getResult(): FasterBandsResult;
    get isStable(): boolean;
}
