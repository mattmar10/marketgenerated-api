import { Big, BigSource } from '../index.js';
import { FasterMovingAverage, MovingAverage } from '../MA/MovingAverage.js';
export declare class EMA extends MovingAverage {
    readonly interval: number;
    private pricesCounter;
    private readonly weightFactor;
    constructor(interval: number);
    update(_price: BigSource): Big;
    getResult(): Big;
    get isStable(): boolean;
}
export declare class FasterEMA extends FasterMovingAverage {
    readonly interval: number;
    private pricesCounter;
    private readonly weightFactor;
    constructor(interval: number);
    update(price: number): number;
    getResult(): number;
    get isStable(): boolean;
}
