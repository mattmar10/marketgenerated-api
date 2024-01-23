import { getFasterAverage, getAverage } from './getAverage.js';
import { Big } from '../index.js';
export function getStandardDeviation(values, average) {
    const middle = average || getAverage(values);
    const squaredDifferences = values.map((value) => new Big(value).sub(middle).pow(2));
    return getAverage(squaredDifferences).sqrt();
}
export function getFasterStandardDeviation(values, average) {
    const middle = average || getFasterAverage(values);
    const squaredDifferences = values.map(value => value - middle).map(value => value * value);
    const averageDifference = getFasterAverage(squaredDifferences);
    return Math.sqrt(averageDifference);
}
//# sourceMappingURL=getStandardDeviation.js.map