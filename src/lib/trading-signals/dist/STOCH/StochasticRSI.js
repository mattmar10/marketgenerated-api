import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { FasterRSI, RSI } from '../RSI/RSI.js';
import { Big } from '../index.js';
import { FasterPeriod, Period } from '../util/Period.js';
import { FasterWSMA, WSMA } from '../WSMA/WSMA.js';
export class StochasticRSI extends BigIndicatorSeries {
    interval;
    period;
    rsi;
    constructor(interval, SmoothingIndicator = WSMA) {
        super();
        this.interval = interval;
        this.period = new Period(interval);
        this.rsi = new RSI(interval, SmoothingIndicator);
    }
    update(price) {
        const rsiResult = this.rsi.update(price);
        if (rsiResult) {
            const periodResult = this.period.update(rsiResult);
            if (periodResult) {
                const min = periodResult.lowest;
                const max = periodResult.highest;
                const denominator = max.minus(min);
                if (denominator.eq(0)) {
                    return this.setResult(new Big(100));
                }
                const numerator = rsiResult.minus(min);
                return this.setResult(numerator.div(denominator));
            }
        }
    }
}
export class FasterStochasticRSI extends NumberIndicatorSeries {
    interval;
    period;
    rsi;
    constructor(interval, SmoothingIndicator = FasterWSMA) {
        super();
        this.interval = interval;
        this.period = new FasterPeriod(interval);
        this.rsi = new FasterRSI(interval, SmoothingIndicator);
    }
    update(price) {
        const rsiResult = this.rsi.update(price);
        if (rsiResult !== undefined) {
            const periodResult = this.period.update(rsiResult);
            if (periodResult) {
                const min = periodResult.lowest;
                const max = periodResult.highest;
                const denominator = max - min;
                if (denominator === 0) {
                    return this.setResult(100);
                }
                const numerator = rsiResult - min;
                return this.setResult(numerator / denominator);
            }
        }
    }
}
//# sourceMappingURL=StochasticRSI.js.map