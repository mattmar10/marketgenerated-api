import { BigIndicatorSeries, NumberIndicatorSeries } from '../Indicator.js';
import { AO, FasterAO } from '../AO/AO.js';
import { FasterSMA, SMA } from '../SMA/SMA.js';
import { FasterMOM, MOM } from '../MOM/MOM.js';
export class AC extends BigIndicatorSeries {
    shortAO;
    longAO;
    signalInterval;
    ao;
    momentum;
    signal;
    constructor(shortAO, longAO, signalInterval) {
        super();
        this.shortAO = shortAO;
        this.longAO = longAO;
        this.signalInterval = signalInterval;
        this.ao = new AO(shortAO, longAO);
        this.momentum = new MOM(1);
        this.signal = new SMA(signalInterval);
    }
    update(input) {
        const ao = this.ao.update(input);
        if (ao) {
            this.signal.update(ao);
            if (this.signal.isStable) {
                const result = this.setResult(ao.sub(this.signal.getResult()));
                this.momentum.update(result);
                return this.result;
            }
        }
    }
}
export class FasterAC extends NumberIndicatorSeries {
    shortAO;
    longAO;
    signalInterval;
    ao;
    momentum;
    signal;
    constructor(shortAO, longAO, signalInterval) {
        super();
        this.shortAO = shortAO;
        this.longAO = longAO;
        this.signalInterval = signalInterval;
        this.ao = new FasterAO(shortAO, longAO);
        this.momentum = new FasterMOM(1);
        this.signal = new FasterSMA(signalInterval);
    }
    update(input) {
        const ao = this.ao.update(input);
        if (ao) {
            this.signal.update(ao);
            if (this.signal.isStable) {
                const result = this.setResult(ao - this.signal.getResult());
                this.momentum.update(result);
                return this.result;
            }
        }
    }
}
//# sourceMappingURL=AC.js.map