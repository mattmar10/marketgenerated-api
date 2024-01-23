import { Big } from '../index.js';
import { FasterMovingAverage, MovingAverage } from '../MA/MovingAverage.js';
export class SMA extends MovingAverage {
    prices = [];
    update(price) {
        this.prices.push(price);
        if (this.prices.length > this.interval) {
            this.prices.shift();
        }
        if (this.prices.length === this.interval) {
            return this.setResult(SMA.getResultFromBatch(this.prices));
        }
    }
    static getResultFromBatch(prices) {
        const sum = prices.reduce((a, b) => a.plus(b), new Big('0'));
        return sum.div(prices.length || 1);
    }
}
export class FasterSMA extends FasterMovingAverage {
    prices = [];
    update(price) {
        this.prices.push(price);
        if (this.prices.length > this.interval) {
            this.prices.shift();
        }
        if (this.prices.length === this.interval) {
            const sum = this.prices.reduce((a, b) => a + b, 0);
            return this.setResult(sum / this.prices.length);
        }
    }
}
//# sourceMappingURL=SMA.js.map