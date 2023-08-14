import { Candle } from "../modles/candle";
import {
  RelativeStrengthLine,
  RelativeStrengthLinePoint,
} from "../services/relative-strength/relative-strength-types";

export function getRelativeStrengthLine(
  benchMarkCandles: Candle[],
  symbolCandles: Candle[]
): RelativeStrengthLine {
  const dataPoints = benchMarkCandles
    .map((s) => {
      const symbolCandle = symbolCandles.find((c) => c.date == s.date);

      if (symbolCandle) {
        return {
          date: s.dateStr,
          value: Number((symbolCandle.close / s.close).toFixed(2)),
        };
      } else {
        return undefined;
      }
    })
    .filter(
      (dataPoint) => dataPoint !== undefined
    ) as RelativeStrengthLinePoint[];

  const line: RelativeStrengthLine = { data: dataPoints };
  return line;
}
