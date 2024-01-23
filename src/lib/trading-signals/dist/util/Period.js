import { Big } from '../index.js';
import { getFixedArray } from './getFixedArray.js';
import { getMinimum } from './getMinimum.js';
import { getMaximum } from './getMaximum.js';
export class Period {
    interval;
    values;
    highest;
    lowest;
    constructor(interval) {
        this.interval = interval;
        this.values = getFixedArray(interval);
    }
    getResult() {
        return {
            highest: this.highest,
            lowest: this.lowest,
        };
    }
    update(value) {
        this.values.push(new Big(value));
        if (this.isStable) {
            this.lowest = getMinimum(this.values);
            this.highest = getMaximum(this.values);
            return this.getResult();
        }
    }
    get isStable() {
        return this.values.length === this.interval;
    }
}
export class FasterPeriod {
    interval;
    values;
    highest;
    lowest;
    constructor(interval) {
        this.interval = interval;
        this.values = getFixedArray(interval);
    }
    getResult() {
        return {
            highest: this.highest,
            lowest: this.lowest,
        };
    }
    update(value) {
        this.values.push(value);
        if (this.isStable) {
            this.lowest = Math.min(...this.values);
            this.highest = Math.max(...this.values);
            return this.getResult();
        }
    }
    get isStable() {
        return this.values.length === this.interval;
    }
}
//# sourceMappingURL=Period.js.map