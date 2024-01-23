import { Big } from '../index.js';
export function getAverage(values) {
    const sum = values.reduce((prev, current) => {
        return prev.add(current);
    }, new Big(0));
    return sum.div(values.length || 1);
}
export function getFasterAverage(values) {
    return values.length ? values.reduce((sum, x) => sum + x, 0) / values.length : 0;
}
//# sourceMappingURL=getAverage.js.map