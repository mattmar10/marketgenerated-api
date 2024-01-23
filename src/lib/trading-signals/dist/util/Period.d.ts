import { Big, BigSource } from '../index.js';
import { Indicator } from '../Indicator.js';
export interface PeriodResult {
    highest: Big;
    lowest: Big;
}
export interface FasterPeriodResult {
    highest: number;
    lowest: number;
}
export declare class Period implements Indicator<PeriodResult> {
    readonly interval: number;
    values: Big[];
    highest?: Big;
    lowest?: Big;
    constructor(interval: number);
    getResult(): PeriodResult;
    update(value: BigSource): PeriodResult | void;
    get isStable(): boolean;
}
export declare class FasterPeriod implements Indicator<FasterPeriodResult> {
    readonly interval: number;
    values: number[];
    highest?: number;
    lowest?: number;
    constructor(interval: number);
    getResult(): FasterPeriodResult;
    update(value: number): FasterPeriodResult | void;
    get isStable(): boolean;
}
