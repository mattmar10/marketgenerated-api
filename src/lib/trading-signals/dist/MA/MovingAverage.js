import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
export class MovingAverage extends BigIndicatorSeries {
    interval;
    constructor(interval) {
        super();
        this.interval = interval;
    }
    updates(prices) {
        prices.forEach(price => this.update(price));
        return this.result;
    }
}
export class FasterMovingAverage extends NumberIndicatorSeries {
    interval;
    constructor(interval) {
        super();
        this.interval = interval;
    }
    updates(prices) {
        prices.forEach(price => this.update(price));
        return this.result;
    }
}
//# sourceMappingURL=MovingAverage.js.map