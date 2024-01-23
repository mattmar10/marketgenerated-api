export function getFixedArray(length) {
    const array = new Array();
    array.push = function (...items) {
        if (items.length >= length) {
            items.splice(0, items.length - length);
        }
        if (this.length >= length) {
            this.shift();
        }
        return Array.prototype.push.apply(this, items);
    };
    return array;
}
//# sourceMappingURL=getFixedArray.js.map