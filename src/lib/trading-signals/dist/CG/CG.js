import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big } from '../index.js';
import { FasterSMA, SMA } from '../SMA/SMA.js';
export class CG extends BigIndicatorSeries {
    interval;
    signalInterval;
    signal;
    prices = [];
    get isStable() {
        return this.signal.isStable;
    }
    constructor(interval, signalInterval) {
        super();
        this.interval = interval;
        this.signalInterval = signalInterval;
        this.signal = new SMA(signalInterval);
    }
    update(price) {
        this.prices.push(new Big(price));
        if (this.prices.length > this.interval) {
            this.prices.shift();
        }
        let nominator = new Big(0);
        let denominator = new Big(0);
        for (let i = 0; i < this.prices.length; ++i) {
            const price = this.prices[i];
            nominator = nominator.plus(price.mul(i + 1));
            denominator = denominator.plus(price);
        }
        const cg = denominator.gt(0) ? nominator.div(denominator) : new Big(0);
        this.signal.update(cg);
        if (this.signal.isStable) {
            return this.setResult(cg);
        }
    }
}
export class FasterCG extends NumberIndicatorSeries {
    interval;
    signalInterval;
    signal;
    prices = [];
    get isStable() {
        return this.signal.isStable;
    }
    constructor(interval, signalInterval) {
        super();
        this.interval = interval;
        this.signalInterval = signalInterval;
        this.signal = new FasterSMA(signalInterval);
    }
    update(price) {
        this.prices.push(price);
        if (this.prices.length > this.interval) {
            this.prices.shift();
        }
        let nominator = 0;
        let denominator = 0;
        for (let i = 0; i < this.prices.length; ++i) {
            const price = this.prices[i];
            nominator = nominator + price * (i + 1);
            denominator = denominator + price;
        }
        const cg = denominator > 0 ? nominator / denominator : 0;
        this.signal.update(cg);
        if (this.signal.isStable) {
            return this.setResult(cg);
        }
    }
}
//# sourceMappingURL=CG.js.map