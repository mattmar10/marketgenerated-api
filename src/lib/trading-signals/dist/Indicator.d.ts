import { Big, BigSource } from './index.js';
export interface Indicator<Result = Big, Input = BigSource> {
    getResult(): Result;
    isStable: boolean;
    update(input: Input): void | Result;
}
export interface IndicatorSeries<Result = Big, Input = BigSource> extends Indicator<Result, Input> {
    highest?: Result;
    lowest?: Result;
}
export declare abstract class BigIndicatorSeries<Input = BigSource> implements IndicatorSeries<Big, Input> {
    highest?: Big;
    lowest?: Big;
    protected result?: Big;
    get isStable(): boolean;
    getResult(): Big;
    protected setResult(value: Big): Big;
    abstract update(input: Input): void | Big;
}
export declare abstract class NumberIndicatorSeries<Input = number> implements IndicatorSeries<number, Input> {
    highest?: number;
    lowest?: number;
    protected result?: number;
    get isStable(): boolean;
    getResult(): number;
    protected setResult(value: number): number;
    abstract update(input: Input): void | number;
}
