import { Big } from '../index.js';
export function getMaximum(values) {
    let max = new Big(Number.MIN_SAFE_INTEGER);
    for (const value of values) {
        if (max.lt(value)) {
            max = new Big(value);
        }
    }
    return max;
}
//# sourceMappingURL=getMaximum.js.map