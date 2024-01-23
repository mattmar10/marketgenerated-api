import { Big } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { getAverage, getFasterAverage } from '../util/index.js';
export class MAD extends BigIndicatorSeries {
    interval;
    prices = [];
    constructor(interval) {
        super();
        this.interval = interval;
    }
    update(price) {
        this.prices.push(price);
        if (this.prices.length > this.interval) {
            this.prices.shift();
        }
        if (this.prices.length === this.interval) {
            return this.setResult(MAD.getResultFromBatch(this.prices));
        }
    }
    static getResultFromBatch(prices, average) {
        const mean = average || getAverage(prices);
        let sum = new Big(0);
        for (let i = 0; i < prices.length; i++) {
            const deviation = new Big(prices[i]).minus(mean).abs();
            sum = sum.plus(deviation);
        }
        return sum.div(prices.length || 1);
    }
}
export class FasterMAD extends NumberIndicatorSeries {
    interval;
    prices = [];
    constructor(interval) {
        super();
        this.interval = interval;
    }
    update(price) {
        this.prices.push(price);
        if (this.prices.length > this.interval) {
            this.prices.shift();
        }
        if (this.prices.length === this.interval) {
            const mean = getFasterAverage(this.prices);
            let sum = 0;
            for (let i = 0; i < this.interval; i++) {
                const deviation = Math.abs(this.prices[i] - mean);
                sum += deviation;
            }
            return this.setResult(sum / this.interval);
        }
    }
    static getResultFromBatch(prices, average) {
        const mean = average || getFasterAverage(prices);
        let sum = 0;
        for (let i = 0; i < prices.length; i++) {
            const deviation = Math.abs(prices[i] - mean);
            sum += deviation;
        }
        return sum / prices.length;
    }
}
//# sourceMappingURL=MAD.js.map