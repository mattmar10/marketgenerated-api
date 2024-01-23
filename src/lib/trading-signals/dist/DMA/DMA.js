import { FasterSMA, SMA } from '../SMA/SMA.js';
export class DMA {
    short;
    long;
    constructor(short, long, Indicator = SMA) {
        this.short = new Indicator(short);
        this.long = new Indicator(long);
    }
    get isStable() {
        return this.long.isStable;
    }
    update(price) {
        this.short.update(price);
        this.long.update(price);
    }
    getResult() {
        return {
            long: this.long.getResult(),
            short: this.short.getResult(),
        };
    }
}
export class FasterDMA {
    short;
    long;
    constructor(short, long, SmoothingIndicator = FasterSMA) {
        this.short = new SmoothingIndicator(short);
        this.long = new SmoothingIndicator(long);
    }
    get isStable() {
        return this.long.isStable;
    }
    update(price) {
        this.short.update(price);
        this.long.update(price);
    }
    getResult() {
        return {
            long: this.long.getResult(),
            short: this.short.getResult(),
        };
    }
}
//# sourceMappingURL=DMA.js.map