import { Indicator } from '../Indicator.js';
import { Big } from '../index.js';
import { HighLowClose, HighLowCloseNumber } from '../util/index.js';
export interface StochasticResult {
    stochD: Big;
    stochK: Big;
}
export interface FasterStochasticResult {
    stochD: number;
    stochK: number;
}
export declare class StochasticOscillator implements Indicator<StochasticResult, HighLowClose> {
    readonly n: number;
    readonly m: number;
    readonly p: number;
    private readonly periodM;
    private readonly periodP;
    private readonly candles;
    private result?;
    constructor(n: number, m: number, p: number);
    getResult(): StochasticResult;
    update(candle: HighLowClose): void | StochasticResult;
    get isStable(): boolean;
}
export declare class FasterStochasticOscillator implements Indicator<FasterStochasticResult, HighLowCloseNumber> {
    n: number;
    m: number;
    p: number;
    readonly candles: HighLowCloseNumber[];
    private result;
    private readonly periodM;
    private readonly periodP;
    constructor(n: number, m: number, p: number);
    getResult(): FasterStochasticResult;
    get isStable(): boolean;
    update(candle: HighLowCloseNumber): void | FasterStochasticResult;
}
