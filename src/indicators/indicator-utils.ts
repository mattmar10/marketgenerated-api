import { Candle } from "../modles/candle";

export function filterCandlesPast52Weeks(candles: Candle[]): Candle[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const oneYearAgo = now.getTime() - 52 * 7 * 24 * 60 * 60 * 1000;

  const sorted = [...candles].sort((a, b) => {
    if (a.date > b.date) {
      return 1;
    } else if (a.date < b.date) {
      return -1;
    }
    return 0;
  });

  return sorted.filter((candle) => {
    return candle.date >= oneYearAgo && candle.date <= now.getTime();
  });
}

export function internalBarStrength(candle: Candle): number {
  return (candle.close - candle.low) / (candle.high - candle.low);
}
