import { NotEnoughDataError } from './error/index.js';
export class BigIndicatorSeries {
    highest;
    lowest;
    result;
    get isStable() {
        return this.result !== undefined;
    }
    getResult() {
        if (this.result === undefined) {
            throw new NotEnoughDataError();
        }
        return this.result;
    }
    setResult(value) {
        if (this.highest === undefined || value.gt(this.highest)) {
            this.highest = value;
        }
        if (this.lowest === undefined || value.lt(this.lowest)) {
            this.lowest = value;
        }
        return (this.result = value);
    }
}
export class NumberIndicatorSeries {
    highest;
    lowest;
    result;
    get isStable() {
        return this.result !== undefined;
    }
    getResult() {
        if (this.result === undefined) {
            throw new NotEnoughDataError();
        }
        return this.result;
    }
    setResult(value) {
        if (this.highest === undefined || value > this.highest) {
            this.highest = value;
        }
        if (this.lowest === undefined || value < this.lowest) {
            this.lowest = value;
        }
        return (this.result = value);
    }
}
//# sourceMappingURL=Indicator.js.map