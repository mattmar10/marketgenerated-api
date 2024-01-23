import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { FasterWSMA, WSMA } from '../WSMA/WSMA.js';
import { DX, FasterDX } from '../DX/DX.js';
export class ADX extends BigIndicatorSeries {
    interval;
    dx;
    adx;
    constructor(interval, SmoothingIndicator = WSMA) {
        super();
        this.interval = interval;
        this.adx = new SmoothingIndicator(this.interval);
        this.dx = new DX(interval, SmoothingIndicator);
    }
    get mdi() {
        return this.dx.mdi;
    }
    get pdi() {
        return this.dx.pdi;
    }
    update(candle) {
        const result = this.dx.update(candle);
        if (result) {
            this.adx.update(result);
        }
        if (this.adx.isStable) {
            return this.setResult(this.adx.getResult());
        }
    }
}
export class FasterADX extends NumberIndicatorSeries {
    interval;
    dx;
    adx;
    constructor(interval, SmoothingIndicator = FasterWSMA) {
        super();
        this.interval = interval;
        this.adx = new SmoothingIndicator(this.interval);
        this.dx = new FasterDX(interval, SmoothingIndicator);
    }
    get mdi() {
        return this.dx.mdi;
    }
    get pdi() {
        return this.dx.pdi;
    }
    update(candle) {
        const result = this.dx.update(candle);
        if (result !== undefined) {
            this.adx.update(result);
        }
        if (this.adx.isStable) {
            return this.setResult(this.adx.getResult());
        }
    }
}
//# sourceMappingURL=ADX.js.map