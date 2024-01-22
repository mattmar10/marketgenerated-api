import { Candle } from "../modles/candle";
import { add, multiplyBy, stdSeries, subtract } from "./line-point-utils";
import { smaSeries } from "./moving-average";

export interface BollingerBandPoint {
  time: string;
  sma: number;
  upperBand: number;
  lowerBand: number;
  percentB: number;
}
export interface BollingerBandsResult {
  period: number;
  timeseries: BollingerBandPoint[];
}

export function isBollingerBandsResult(obj: any): obj is BollingerBandsResult {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.period === "number" &&
    Array.isArray(obj.timeseries) &&
    obj.timeseries.every(
      (point: BollingerBandPoint) =>
        typeof point === "object" &&
        point !== null &&
        typeof point.time === "string" &&
        typeof point.sma === "number" &&
        typeof point.upperBand === "number" &&
        typeof point.lowerBand === "number" &&
        typeof point.percentB === "number"
    )
  );
}

export function bollingerBands(
  candles: Candle[],
  period: number,
  multiplier: number = 2
): BollingerBandsResult {
  const stdDev = stdSeries(period, candles);
  const std2 = multiplyBy(multiplier, stdDev);
  const middleBand = smaSeries(period, candles);
  const upperBand = add(middleBand, std2);
  const lowerBand = subtract(middleBand, std2);

  const results: BollingerBandPoint[] = [];

  for (let i = 0; i < candles.length; i++) {
    const dateStr = candles[i].dateStr;
    const middle = middleBand.find((m) => m.time === dateStr);
    const lower = lowerBand.find((m) => m.time === dateStr);
    const upper = upperBand.find((m) => m.time === dateStr);

    if (!dateStr || !middle || !lower || !upper) {
      console.error(
        `Cannot calculate Bollinger Bands with mimssing date string`
      );
      continue;
    }

    (candles[i].close - lower.value) / (upper.value - lower.value);

    const point: BollingerBandPoint = {
      time: dateStr,
      sma: middle.value,
      upperBand: upper.value,
      lowerBand: lower.value,
      percentB: 0,
    };

    results.push(point);
  }

  const bbResult: BollingerBandsResult = {
    period: period,
    timeseries: results,
  };

  return bbResult;
}
