import { Big } from '../index.js';
import { SMA } from '../SMA/SMA.js';
import { NotEnoughDataError } from '../error/index.js';
import { getFasterAverage, getFasterStandardDeviation, getStandardDeviation } from '../util/index.js';
export class BollingerBands {
    interval;
    deviationMultiplier;
    prices = [];
    result;
    constructor(interval, deviationMultiplier = 2) {
        this.interval = interval;
        this.deviationMultiplier = deviationMultiplier;
    }
    get isStable() {
        return this.result !== undefined;
    }
    update(price) {
        this.prices.push(new Big(price));
        if (this.prices.length > this.interval) {
            this.prices.shift();
            const middle = SMA.getResultFromBatch(this.prices);
            const standardDeviation = getStandardDeviation(this.prices, middle);
            return (this.result = {
                lower: middle.sub(standardDeviation.times(this.deviationMultiplier)),
                middle,
                upper: middle.add(standardDeviation.times(this.deviationMultiplier)),
            });
        }
    }
    getResult() {
        if (this.result === undefined) {
            throw new NotEnoughDataError();
        }
        return this.result;
    }
}
export class FasterBollingerBands {
    interval;
    deviationMultiplier;
    prices = [];
    result;
    constructor(interval, deviationMultiplier = 2) {
        this.interval = interval;
        this.deviationMultiplier = deviationMultiplier;
    }
    update(price) {
        this.prices.push(price);
        if (this.prices.length > this.interval) {
            this.prices.shift();
            const middle = getFasterAverage(this.prices);
            const standardDeviation = getFasterStandardDeviation(this.prices, middle);
            return (this.result = {
                lower: middle - standardDeviation * this.deviationMultiplier,
                middle,
                upper: middle + standardDeviation * this.deviationMultiplier,
            });
        }
    }
    getResult() {
        if (this.result === undefined) {
            throw new NotEnoughDataError();
        }
        return this.result;
    }
    get isStable() {
        return this.result !== undefined;
    }
}
//# sourceMappingURL=BollingerBands.js.map