import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { Big } from '../index.js';
import { FasterWSMA, WSMA } from '../WSMA/WSMA.js';
import { ATR, FasterATR } from '../ATR/ATR.js';
export class DX extends BigIndicatorSeries {
    interval;
    movesUp;
    movesDown;
    previousCandle;
    atr;
    mdi;
    pdi;
    constructor(interval, SmoothingIndicator = WSMA) {
        super();
        this.interval = interval;
        this.atr = new ATR(this.interval, SmoothingIndicator);
        this.movesDown = new SmoothingIndicator(this.interval);
        this.movesUp = new SmoothingIndicator(this.interval);
    }
    updateState(candle, pdm = 0, mdm = 0) {
        this.atr.update(candle);
        this.movesDown.update(mdm);
        this.movesUp.update(pdm);
        this.previousCandle = candle;
    }
    update(candle) {
        if (!this.previousCandle) {
            this.updateState(candle);
            return;
        }
        const currentHigh = new Big(candle.high);
        const previousHigh = new Big(this.previousCandle.high);
        const currentLow = new Big(candle.low);
        const previousLow = new Big(this.previousCandle.low);
        const higherHigh = currentHigh.minus(previousHigh);
        const lowerLow = previousLow.minus(currentLow);
        const noHigherHighs = higherHigh.lt(0);
        const lowsRiseFaster = higherHigh.lt(lowerLow);
        const pdm = noHigherHighs || lowsRiseFaster ? new Big(0) : higherHigh;
        const noLowerLows = lowerLow.lt(0);
        const highsRiseFaster = lowerLow.lt(higherHigh);
        const mdm = noLowerLows || highsRiseFaster ? new Big(0) : lowerLow;
        this.updateState(candle, pdm, mdm);
        if (this.movesUp.isStable) {
            this.pdi = this.movesUp.getResult().div(this.atr.getResult());
            this.mdi = this.movesDown.getResult().div(this.atr.getResult());
            const dmDiff = this.pdi.minus(this.mdi).abs();
            const dmSum = this.pdi.plus(this.mdi);
            if (dmSum.eq(0)) {
                return this.setResult(new Big(0));
            }
            return this.setResult(dmDiff.div(dmSum).mul(100));
        }
    }
}
export class FasterDX extends NumberIndicatorSeries {
    interval;
    movesUp;
    movesDown;
    previousCandle;
    atr;
    mdi;
    pdi;
    constructor(interval, SmoothingIndicator = FasterWSMA) {
        super();
        this.interval = interval;
        this.atr = new FasterATR(this.interval, SmoothingIndicator);
        this.movesDown = new SmoothingIndicator(this.interval);
        this.movesUp = new SmoothingIndicator(this.interval);
    }
    updateState(candle, pdm = 0, mdm = 0) {
        this.atr.update(candle);
        this.movesUp.update(pdm);
        this.movesDown.update(mdm);
        this.previousCandle = candle;
    }
    update(candle) {
        if (!this.previousCandle) {
            this.updateState(candle);
            return;
        }
        const currentHigh = candle.high;
        const previousHigh = this.previousCandle.high;
        const currentLow = candle.low;
        const previousLow = this.previousCandle.low;
        const higherHigh = currentHigh - previousHigh;
        const lowerLow = previousLow - currentLow;
        const noHigherHighs = higherHigh < 0;
        const lowsRiseFaster = higherHigh < lowerLow;
        const pdm = noHigherHighs || lowsRiseFaster ? 0 : higherHigh;
        const noLowerLows = lowerLow < 0;
        const highsRiseFaster = lowerLow < higherHigh;
        const mdm = noLowerLows || highsRiseFaster ? 0 : lowerLow;
        this.updateState(candle, pdm, mdm);
        if (this.movesUp.isStable) {
            this.pdi = this.movesUp.getResult() / this.atr.getResult();
            this.mdi = this.movesDown.getResult() / this.atr.getResult();
            const dmDiff = Math.abs(this.pdi - this.mdi);
            const dmSum = this.pdi + this.mdi;
            if (dmSum === 0) {
                return this.setResult(0);
            }
            return this.setResult((dmDiff / dmSum) * 100);
        }
    }
}
//# sourceMappingURL=DX.js.map