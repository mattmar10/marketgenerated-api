export class NotEnoughDataError extends Error {
    constructor(message = 'Not enough data') {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'NotEnoughDataError';
    }
}
//# sourceMappingURL=NotEnoughDataError.js.map