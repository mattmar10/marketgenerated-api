import { Candle } from "../modles/candle";
import { LinePoint } from "./linep-point-types";
import { SMA } from "../lib/trading-signals/dist/SMA/SMA";

/*
 * TR = Max((High - Low), (High - Closing), (Closing - Low))
 * ATR = SMA TR
 **/

export interface AtrResult {
  period: number;
  timeseries: LinePoint[];
}

export function atr(candles: Candle[], period: number): AtrResult {
  const sma: SMA = new SMA(period);

  const timeseries: LinePoint[] = [];
  const trueRanges: LinePoint[] = [];
  let sumTrueRange = 0;

  for (let i = 0; i < candles.length; i++) {
    // sma.update(candles[i].close);
    const trueRange = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(
        candles[i].high - (i > 0 ? candles[i - 1].close : candles[i].close)
      ),
      Math.abs(
        candles[i].low - (i > 0 ? candles[i - 1].close : candles[i].close)
      )
    );

    const point: LinePoint = {
      time: candles[i].dateStr!,
      value: trueRange,
    };

    trueRanges.push(point);

    sumTrueRange += trueRange;

    if (i >= period - 1) {
      const atr = sumTrueRange / period;
      const atrpoint: LinePoint = {
        time: candles[i].dateStr!,
        value: atr,
      };

      timeseries.push(atrpoint);

      // Adjust sum by removing oldest True Range value
      sumTrueRange -= trueRanges[i - period + 1].value;
    }
  }

  return {
    period,
    timeseries,
  };
}
