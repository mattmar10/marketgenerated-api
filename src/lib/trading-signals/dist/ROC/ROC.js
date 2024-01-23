import { Big } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
export class ROC extends BigIndicatorSeries {
    interval;
    prices = [];
    constructor(interval) {
        super();
        this.interval = interval;
    }
    update(price) {
        this.prices.push(new Big(price));
        if (this.prices.length > this.interval) {
            const comparePrice = this.prices.shift();
            return this.setResult(new Big(price).sub(comparePrice).div(comparePrice));
        }
    }
}
export class FasterROC extends NumberIndicatorSeries {
    interval;
    prices = [];
    constructor(interval) {
        super();
        this.interval = interval;
    }
    update(price) {
        this.prices.push(price);
        if (this.prices.length > this.interval) {
            const comparePrice = this.prices.shift();
            return this.setResult((price - comparePrice) / comparePrice);
        }
    }
}
//# sourceMappingURL=ROC.js.map