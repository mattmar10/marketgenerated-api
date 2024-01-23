import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { FasterTR, TR } from '../TR/TR.js';
import { FasterWSMA, WSMA } from '../WSMA/WSMA.js';
export class ATR extends BigIndicatorSeries {
    interval;
    tr;
    smoothing;
    constructor(interval, SmoothingIndicator = WSMA) {
        super();
        this.interval = interval;
        this.tr = new TR();
        this.smoothing = new SmoothingIndicator(interval);
    }
    update(candle) {
        const trueRange = this.tr.update(candle);
        this.smoothing.update(trueRange);
        if (this.smoothing.isStable) {
            return this.setResult(this.smoothing.getResult());
        }
    }
}
export class FasterATR extends NumberIndicatorSeries {
    interval;
    tr;
    smoothing;
    constructor(interval, SmoothingIndicator = FasterWSMA) {
        super();
        this.interval = interval;
        this.tr = new FasterTR();
        this.smoothing = new SmoothingIndicator(interval);
    }
    update(candle) {
        const trueRange = this.tr.update(candle);
        this.smoothing.update(trueRange);
        if (this.smoothing.isStable) {
            return this.setResult(this.smoothing.getResult());
        }
    }
}
//# sourceMappingURL=ATR.js.map