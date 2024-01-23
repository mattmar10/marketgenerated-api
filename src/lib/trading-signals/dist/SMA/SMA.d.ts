import { Big, BigSource } from '../index.js';
import { FasterMovingAverage, MovingAverage } from '../MA/MovingAverage.js';
export declare class SMA extends MovingAverage {
    readonly prices: BigSource[];
    update(price: BigSource): Big | void;
    static getResultFromBatch(prices: BigSource[]): Big;
}
export declare class FasterSMA extends FasterMovingAverage {
    readonly prices: number[];
    update(price: number): void | number;
}
