import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big } from '../index.js';
import { FasterSMA, SMA } from '../SMA/SMA.js';
export class AO extends BigIndicatorSeries {
    shortInterval;
    longInterval;
    long;
    short;
    constructor(shortInterval, longInterval, SmoothingIndicator = SMA) {
        super();
        this.shortInterval = shortInterval;
        this.longInterval = longInterval;
        this.short = new SmoothingIndicator(shortInterval);
        this.long = new SmoothingIndicator(longInterval);
    }
    update({ low, high }) {
        const candleSum = new Big(low).add(high);
        const medianPrice = candleSum.div(2);
        this.short.update(medianPrice);
        this.long.update(medianPrice);
        if (this.long.isStable) {
            return this.setResult(this.short.getResult().sub(this.long.getResult()));
        }
    }
}
export class FasterAO extends NumberIndicatorSeries {
    shortInterval;
    longInterval;
    long;
    short;
    constructor(shortInterval, longInterval, SmoothingIndicator = FasterSMA) {
        super();
        this.shortInterval = shortInterval;
        this.longInterval = longInterval;
        this.short = new SmoothingIndicator(shortInterval);
        this.long = new SmoothingIndicator(longInterval);
    }
    update({ low, high }) {
        const medianPrice = (low + high) / 2;
        this.short.update(medianPrice);
        this.long.update(medianPrice);
        if (this.long.isStable) {
            return this.setResult(this.short.getResult() - this.long.getResult());
        }
    }
}
//# sourceMappingURL=AO.js.map