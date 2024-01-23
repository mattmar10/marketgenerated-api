import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big } from '../index.js';
import { FasterSMA, SMA } from '../SMA/SMA.js';
import { FasterMAD, MAD } from '../MAD/MAD.js';
export class CCI extends BigIndicatorSeries {
    interval;
    prices = [];
    sma;
    typicalPrices = [];
    constructor(interval) {
        super();
        this.interval = interval;
        this.sma = new SMA(this.interval);
    }
    update(candle) {
        const typicalPrice = this.cacheTypicalPrice(candle);
        this.sma.update(typicalPrice);
        if (this.sma.isStable) {
            const mean = this.sma.getResult();
            const meanDeviation = MAD.getResultFromBatch(this.typicalPrices, mean);
            const numerator = typicalPrice.minus(mean);
            const denominator = new Big(0.015).mul(meanDeviation);
            return this.setResult(numerator.div(denominator));
        }
    }
    cacheTypicalPrice({ high, low, close }) {
        const typicalPrice = new Big(high).plus(low).plus(close).div(3);
        this.typicalPrices.push(typicalPrice);
        if (this.typicalPrices.length > this.interval) {
            this.typicalPrices.shift();
        }
        return typicalPrice;
    }
}
export class FasterCCI extends NumberIndicatorSeries {
    interval;
    prices = [];
    sma;
    typicalPrices = [];
    constructor(interval) {
        super();
        this.interval = interval;
        this.sma = new FasterSMA(this.interval);
    }
    update(candle) {
        const typicalPrice = this.cacheTypicalPrice(candle);
        this.sma.update(typicalPrice);
        if (this.sma.isStable) {
            const mean = this.sma.getResult();
            const meanDeviation = FasterMAD.getResultFromBatch(this.typicalPrices, mean);
            const numerator = typicalPrice - mean;
            const denominator = 0.015 * meanDeviation;
            return this.setResult(numerator / denominator);
        }
    }
    cacheTypicalPrice({ high, low, close }) {
        const typicalPrice = (high + low + close) / 3;
        this.typicalPrices.push(typicalPrice);
        if (this.typicalPrices.length > this.interval) {
            this.typicalPrices.shift();
        }
        return typicalPrice;
    }
}
//# sourceMappingURL=CCI.js.map