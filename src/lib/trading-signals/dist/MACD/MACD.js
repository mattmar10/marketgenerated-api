import { Big, NotEnoughDataError } from '../index.js';
export class MACD {
    prices = [];
    long;
    short;
    signal;
    result;
    constructor(config) {
        this.long = new config.indicator(config.longInterval);
        this.short = new config.indicator(config.shortInterval);
        this.signal = new config.indicator(config.signalInterval);
    }
    get isStable() {
        return this.result !== undefined;
    }
    update(_price) {
        const price = new Big(_price);
        this.prices.push(price);
        const short = this.short.update(price);
        const long = this.long.update(price);
        if (this.prices.length > this.long.interval) {
            this.prices.shift();
        }
        if (this.prices.length === this.long.interval) {
            const macd = short.sub(long);
            const signal = this.signal.update(macd);
            return (this.result = {
                histogram: macd.sub(signal),
                macd: macd,
                signal,
            });
        }
    }
    getResult() {
        if (!this.isStable || this.result === undefined) {
            throw new NotEnoughDataError();
        }
        return this.result;
    }
}
export class FasterMACD {
    short;
    long;
    signal;
    prices = [];
    result;
    constructor(short, long, signal) {
        this.short = short;
        this.long = long;
        this.signal = signal;
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
    update(price) {
        this.prices.push(price);
        const short = this.short.update(price);
        const long = this.long.update(price);
        if (this.prices.length > this.long.interval) {
            this.prices.shift();
        }
        if (this.prices.length === this.long.interval) {
            const macd = short - long;
            const signal = this.signal.update(macd);
            return (this.result = {
                histogram: macd - signal,
                macd,
                signal,
            });
        }
    }
}
//# sourceMappingURL=MACD.js.map