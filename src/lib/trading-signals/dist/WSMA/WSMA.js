import { Big } from '../index.js';
import { MovingAverage } from '../MA/MovingAverage.js';
import { FasterSMA, SMA } from '../SMA/SMA.js';
import { NumberIndicatorSeries } from '../Indicator.js';
export class WSMA extends MovingAverage {
    interval;
    indicator;
    smoothingFactor;
    constructor(interval) {
        super(interval);
        this.interval = interval;
        this.indicator = new SMA(interval);
        this.smoothingFactor = new Big(1).div(this.interval);
    }
    updates(prices) {
        prices.forEach(price => this.update(price));
        return this.result;
    }
    update(price) {
        const sma = this.indicator.update(price);
        if (this.result) {
            const smoothed = new Big(price).minus(this.result).mul(this.smoothingFactor);
            return this.setResult(smoothed.plus(this.result));
        }
        else if (this.result === undefined && sma) {
            return this.setResult(sma);
        }
    }
}
export class FasterWSMA extends NumberIndicatorSeries {
    interval;
    indicator;
    smoothingFactor;
    constructor(interval) {
        super();
        this.interval = interval;
        this.indicator = new FasterSMA(interval);
        this.smoothingFactor = 1 / this.interval;
    }
    updates(prices) {
        prices.forEach(price => this.update(price));
        return this.result;
    }
    update(price) {
        const sma = this.indicator.update(price);
        if (this.result !== undefined) {
            const smoothed = (price - this.result) * this.smoothingFactor;
            return this.setResult(smoothed + this.result);
        }
        else if (this.result === undefined && sma !== undefined) {
            return this.setResult(sma);
        }
    }
}
//# sourceMappingURL=WSMA.js.map