import { Big } from '../index.js';
import { FasterSMA, SMA } from '../SMA/SMA.js';
import { getMaximum } from '../util/getMaximum.js';
import { getMinimum } from '../util/getMinimum.js';
import { NotEnoughDataError } from '../error/index.js';
export class StochasticOscillator {
    n;
    m;
    p;
    periodM;
    periodP;
    candles = [];
    result;
    constructor(n, m, p) {
        this.n = n;
        this.m = m;
        this.p = p;
        this.periodM = new SMA(m);
        this.periodP = new SMA(p);
    }
    getResult() {
        if (this.result === undefined) {
            throw new NotEnoughDataError();
        }
        return this.result;
    }
    update(candle) {
        this.candles.push(candle);
        if (this.candles.length > this.n) {
            this.candles.shift();
        }
        if (this.candles.length === this.n) {
            const highest = getMaximum(this.candles.map(candle => candle.high));
            const lowest = getMinimum(this.candles.map(candle => candle.low));
            const divisor = new Big(highest).minus(lowest);
            let fastK = new Big(100).mul(new Big(candle.close).minus(lowest));
            fastK = fastK.div(divisor.eq(0) ? 1 : divisor);
            const stochK = this.periodM.update(fastK);
            const stochD = stochK && this.periodP.update(stochK);
            if (stochK && stochD) {
                return (this.result = {
                    stochD,
                    stochK,
                });
            }
        }
    }
    get isStable() {
        return this.result !== undefined;
    }
}
export class FasterStochasticOscillator {
    n;
    m;
    p;
    candles = [];
    result;
    periodM;
    periodP;
    constructor(n, m, p) {
        this.n = n;
        this.m = m;
        this.p = p;
        this.periodM = new FasterSMA(m);
        this.periodP = new FasterSMA(p);
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
    update(candle) {
        this.candles.push(candle);
        if (this.candles.length > this.n) {
            this.candles.shift();
        }
        if (this.candles.length === this.n) {
            const highest = Math.max(...this.candles.map(candle => candle.high));
            const lowest = Math.min(...this.candles.map(candle => candle.low));
            const divisor = highest - lowest;
            let fastK = (candle.close - lowest) * 100;
            fastK = fastK / (divisor === 0 ? 1 : divisor);
            const stochK = this.periodM.update(fastK);
            const stochD = stochK && this.periodP.update(stochK);
            if (stochK !== undefined && stochD !== undefined) {
                return (this.result = {
                    stochD,
                    stochK,
                });
            }
        }
    }
}
//# sourceMappingURL=StochasticOscillator.js.map