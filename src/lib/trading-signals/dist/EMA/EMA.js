import { Big } from '../index.js';
import { FasterMovingAverage, MovingAverage } from '../MA/MovingAverage.js';
import { NotEnoughDataError } from '../error/index.js';
export class EMA extends MovingAverage {
    interval;
    pricesCounter = 0;
    weightFactor;
    constructor(interval) {
        super(interval);
        this.interval = interval;
        this.weightFactor = 2 / (this.interval + 1);
    }
    update(_price) {
        this.pricesCounter++;
        const price = new Big(_price);
        if (this.result === undefined) {
            this.result = price;
        }
        return this.setResult(price.times(this.weightFactor).add(this.result.times(1 - this.weightFactor)));
    }
    getResult() {
        if (this.pricesCounter < this.interval) {
            throw new NotEnoughDataError();
        }
        return this.result;
    }
    get isStable() {
        try {
            this.getResult();
            return true;
        }
        catch {
            return false;
        }
    }
}
export class FasterEMA extends FasterMovingAverage {
    interval;
    pricesCounter = 0;
    weightFactor;
    constructor(interval) {
        super(interval);
        this.interval = interval;
        this.weightFactor = 2 / (this.interval + 1);
    }
    update(price) {
        this.pricesCounter++;
        if (this.result === undefined) {
            this.result = price;
        }
        return this.setResult(price * this.weightFactor + this.result * (1 - this.weightFactor));
    }
    getResult() {
        if (this.pricesCounter < this.interval) {
            throw new NotEnoughDataError();
        }
        return this.result;
    }
    get isStable() {
        try {
            this.getResult();
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=EMA.js.map