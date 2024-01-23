import { Big } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { getMaximum } from '../util/index.js';
export class TR extends BigIndicatorSeries {
    previousCandle;
    update(candle) {
        const high = new Big(candle.high);
        const highLow = high.minus(candle.low);
        if (this.previousCandle) {
            const highClose = high.minus(this.previousCandle.close).abs();
            const lowClose = new Big(candle.low).minus(this.previousCandle.close).abs();
            this.previousCandle = candle;
            return this.setResult(getMaximum([highLow, highClose, lowClose]));
        }
        this.previousCandle = candle;
        return this.setResult(highLow);
    }
}
export class FasterTR extends NumberIndicatorSeries {
    previousCandle;
    update(candle) {
        const { high, low } = candle;
        const highLow = high - low;
        if (this.previousCandle) {
            const highClose = Math.abs(high - this.previousCandle.close);
            const lowClose = Math.abs(low - this.previousCandle.close);
            this.previousCandle = candle;
            return this.setResult(Math.max(highLow, highClose, lowClose));
        }
        this.previousCandle = candle;
        return this.setResult(highLow);
    }
}
//# sourceMappingURL=TR.js.map