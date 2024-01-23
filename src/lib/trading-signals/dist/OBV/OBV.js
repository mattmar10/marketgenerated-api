import { Big } from '../index.js';
import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
export class OBV extends BigIndicatorSeries {
    candles = [];
    update(candle) {
        this.candles.push(candle);
        if (this.candles.length === 1) {
            return;
        }
        const prevCandle = this.candles[this.candles.length - 2];
        const prevPrice = prevCandle.close;
        const prevResult = this.result ?? new Big(0);
        const currentPrice = new Big(candle.close);
        const nextResult = currentPrice.gt(prevPrice) ? candle.volume : currentPrice.lt(prevPrice) ? -candle.volume : 0;
        return this.setResult(prevResult.add(nextResult));
    }
}
export class FasterOBV extends NumberIndicatorSeries {
    candles = [];
    update(candle) {
        this.candles.push(candle);
        if (this.candles.length === 1) {
            return;
        }
        const prevCandle = this.candles[this.candles.length - 2];
        const prevPrice = prevCandle.close;
        const prevResult = this.result ?? 0;
        const currentPrice = candle.close;
        const nextResult = currentPrice > prevPrice ? candle.volume : currentPrice < prevPrice ? -candle.volume : 0;
        return this.setResult(prevResult + nextResult);
    }
}
//# sourceMappingURL=OBV.js.map