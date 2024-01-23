import { EMA, FasterEMA } from '../EMA/EMA.js';
import { Big, BigSource, DEMA, FasterDEMA } from '../index.js';
import { Indicator } from '../Indicator.js';
export type MACDConfig = {
    indicator: typeof EMA | typeof DEMA;
    longInterval: number;
    shortInterval: number;
    signalInterval: number;
};
export type MACDResult = {
    histogram: Big;
    macd: Big;
    signal: Big;
};
export type FasterMACDResult = {
    histogram: number;
    macd: number;
    signal: number;
};
export declare class MACD implements Indicator<MACDResult> {
    readonly prices: BigSource[];
    readonly long: EMA | DEMA;
    readonly short: EMA | DEMA;
    private readonly signal;
    private result;
    constructor(config: MACDConfig);
    get isStable(): boolean;
    update(_price: BigSource): void | MACDResult;
    getResult(): MACDResult;
}
export declare class FasterMACD implements Indicator<FasterMACDResult> {
    readonly short: FasterEMA | FasterDEMA;
    readonly long: FasterEMA | FasterDEMA;
    readonly signal: FasterEMA | FasterDEMA;
    readonly prices: number[];
    private result;
    constructor(short: FasterEMA | FasterDEMA, long: FasterEMA | FasterDEMA, signal: FasterEMA | FasterDEMA);
    getResult(): FasterMACDResult;
    get isStable(): boolean;
    update(price: number): void | FasterMACDResult;
}
