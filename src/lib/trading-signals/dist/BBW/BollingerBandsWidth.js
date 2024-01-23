import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
export class BollingerBandsWidth extends BigIndicatorSeries {
    bollingerBands;
    constructor(bollingerBands) {
        super();
        this.bollingerBands = bollingerBands;
    }
    update(price) {
        const result = this.bollingerBands.update(price);
        if (result) {
            return this.setResult(result.upper.minus(result.lower).div(result.middle));
        }
    }
}
export class FasterBollingerBandsWidth extends NumberIndicatorSeries {
    bollingerBands;
    constructor(bollingerBands) {
        super();
        this.bollingerBands = bollingerBands;
    }
    update(price) {
        const result = this.bollingerBands.update(price);
        if (result !== undefined) {
            return this.setResult((result.upper - result.lower) / result.middle);
        }
    }
}
//# sourceMappingURL=BollingerBandsWidth.js.map