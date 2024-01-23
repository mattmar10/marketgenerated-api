import { Big, BigSource } from '../index.js';
import { Indicator } from '../Indicator.js';
import { FasterMovingAverage, MovingAverage } from '../MA/MovingAverage.js';
import { FasterMovingAverageTypes, MovingAverageTypes } from '../MA/MovingAverageTypes.js';
export type DMAResult = {
    long: Big;
    short: Big;
};
export interface FasterDMAResult {
    long: number;
    short: number;
}
export declare class DMA implements Indicator<DMAResult> {
    readonly short: MovingAverage;
    readonly long: MovingAverage;
    constructor(short: number, long: number, Indicator?: MovingAverageTypes);
    get isStable(): boolean;
    update(price: BigSource): void;
    getResult(): DMAResult;
}
export declare class FasterDMA implements Indicator<FasterDMAResult, number> {
    readonly short: FasterMovingAverage;
    readonly long: FasterMovingAverage;
    constructor(short: number, long: number, SmoothingIndicator?: FasterMovingAverageTypes);
    get isStable(): boolean;
    update(price: number): void;
    getResult(): FasterDMAResult;
}
