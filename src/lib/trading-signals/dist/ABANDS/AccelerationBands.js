import { Big } from '../index.js';
import { FasterSMA, SMA } from '../SMA/SMA.js';
import { NotEnoughDataError } from '../error/index.js';
export class AccelerationBands {
    interval;
    width;
    lowerBand;
    middleBand;
    upperBand;
    constructor(interval, width, SmoothingIndicator = SMA) {
        this.interval = interval;
        this.width = width;
        this.lowerBand = new SmoothingIndicator(interval);
        this.middleBand = new SmoothingIndicator(interval);
        this.upperBand = new SmoothingIndicator(interval);
    }
    get isStable() {
        return this.middleBand.isStable;
    }
    update({ high, low, close }) {
        const highPlusLow = new Big(high).plus(low);
        const coefficient = highPlusLow.eq(0) ? new Big(0) : new Big(high).minus(low).div(highPlusLow).mul(this.width);
        this.lowerBand.update(new Big(low).mul(new Big(1).minus(coefficient)));
        this.middleBand.update(close);
        this.upperBand.update(new Big(high).mul(new Big(1).plus(coefficient)));
    }
    getResult() {
        if (!this.isStable) {
            throw new NotEnoughDataError();
        }
        return {
            lower: this.lowerBand.getResult(),
            middle: this.middleBand.getResult(),
            upper: this.upperBand.getResult(),
        };
    }
}
export class FasterAccelerationBands {
    interval;
    width;
    lowerBand;
    middleBand;
    upperBand;
    constructor(interval, width, SmoothingIndicator = FasterSMA) {
        this.interval = interval;
        this.width = width;
        this.lowerBand = new SmoothingIndicator(interval);
        this.middleBand = new SmoothingIndicator(interval);
        this.upperBand = new SmoothingIndicator(interval);
    }
    update({ high, low, close }) {
        const highPlusLow = high + low;
        const coefficient = highPlusLow === 0 ? 0 : ((high - low) / highPlusLow) * this.width;
        this.lowerBand.update(low * (1 - coefficient));
        this.middleBand.update(close);
        this.upperBand.update(high * (1 + coefficient));
    }
    get isStable() {
        return this.middleBand.isStable;
    }
    getResult() {
        if (!this.isStable) {
            throw new NotEnoughDataError();
        }
        return {
            lower: this.lowerBand.getResult(),
            middle: this.middleBand.getResult(),
            upper: this.upperBand.getResult(),
        };
    }
}
//# sourceMappingURL=AccelerationBands.js.map