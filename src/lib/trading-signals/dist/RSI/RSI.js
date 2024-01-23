import { Big } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { FasterWSMA, WSMA } from '../WSMA/WSMA.js';
export class RSI extends BigIndicatorSeries {
    interval;
    previousPrice;
    avgGain;
    avgLoss;
    maxValue = new Big(100);
    constructor(interval, SmoothingIndicator = WSMA) {
        super();
        this.interval = interval;
        this.avgGain = new SmoothingIndicator(this.interval);
        this.avgLoss = new SmoothingIndicator(this.interval);
    }
    update(price) {
        if (!this.previousPrice) {
            this.previousPrice = price;
            return;
        }
        const currentPrice = new Big(price);
        const previousPrice = new Big(this.previousPrice);
        if (currentPrice.gt(previousPrice)) {
            this.avgLoss.update(new Big(0));
            this.avgGain.update(currentPrice.sub(previousPrice));
        }
        else {
            this.avgLoss.update(previousPrice.sub(currentPrice));
            this.avgGain.update(new Big(0));
        }
        this.previousPrice = price;
        if (this.avgGain.isStable) {
            const avgLoss = this.avgLoss.getResult();
            if (avgLoss.eq(0)) {
                return this.setResult(new Big(100));
            }
            const relativeStrength = this.avgGain.getResult().div(avgLoss);
            return this.setResult(this.maxValue.minus(this.maxValue.div(relativeStrength.add(1))));
        }
    }
}
export class FasterRSI extends NumberIndicatorSeries {
    interval;
    previousPrice;
    avgGain;
    avgLoss;
    maxValue = 100;
    constructor(interval, SmoothingIndicator = FasterWSMA) {
        super();
        this.interval = interval;
        this.avgGain = new SmoothingIndicator(this.interval);
        this.avgLoss = new SmoothingIndicator(this.interval);
    }
    update(price) {
        if (!this.previousPrice) {
            this.previousPrice = price;
            return;
        }
        if (price > this.previousPrice) {
            this.avgLoss.update(0);
            this.avgGain.update(price - this.previousPrice);
        }
        else {
            this.avgLoss.update(this.previousPrice - price);
            this.avgGain.update(0);
        }
        this.previousPrice = price;
        if (this.avgGain.isStable) {
            const avgLoss = this.avgLoss.getResult();
            if (avgLoss === 0) {
                return this.setResult(100);
            }
            const relativeStrength = this.avgGain.getResult() / avgLoss;
            return this.setResult(this.maxValue - this.maxValue / (relativeStrength + 1));
        }
    }
}
//# sourceMappingURL=RSI.js.map