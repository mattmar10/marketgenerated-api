import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big } from '../index.js';
import { getFixedArray } from '../util/getFixedArray.js';
export class MOM extends BigIndicatorSeries {
    interval;
    history;
    historyLength;
    constructor(interval) {
        super();
        this.interval = interval;
        this.historyLength = interval + 1;
        this.history = getFixedArray(this.historyLength);
    }
    update(value) {
        this.history.push(value);
        if (this.history.length === this.historyLength) {
            return this.setResult(new Big(value).minus(this.history[0]));
        }
    }
}
export class FasterMOM extends NumberIndicatorSeries {
    interval;
    history;
    historyLength;
    constructor(interval) {
        super();
        this.interval = interval;
        this.historyLength = interval + 1;
        this.history = getFixedArray(this.historyLength);
    }
    update(value) {
        this.history.push(value);
        if (this.history.length === this.historyLength) {
            return this.setResult(value - this.history[0]);
        }
    }
}
//# sourceMappingURL=MOM.js.map