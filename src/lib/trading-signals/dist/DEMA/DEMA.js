import { EMA, FasterEMA } from '../EMA/EMA.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
export class DEMA extends BigIndicatorSeries {
    interval;
    inner;
    outer;
    constructor(interval) {
        super();
        this.interval = interval;
        this.inner = new EMA(interval);
        this.outer = new EMA(interval);
    }
    update(price) {
        const innerResult = this.inner.update(price);
        const outerResult = this.outer.update(innerResult);
        return this.setResult(innerResult.times(2).sub(outerResult));
    }
    get isStable() {
        return this.outer.isStable;
    }
}
export class FasterDEMA extends NumberIndicatorSeries {
    interval;
    inner;
    outer;
    constructor(interval) {
        super();
        this.interval = interval;
        this.inner = new FasterEMA(interval);
        this.outer = new FasterEMA(interval);
    }
    update(price) {
        const innerResult = this.inner.update(price);
        const outerResult = this.outer.update(innerResult);
        return this.setResult(innerResult * 2 - outerResult);
    }
    get isStable() {
        return this.outer.isStable;
    }
}
//# sourceMappingURL=DEMA.js.map