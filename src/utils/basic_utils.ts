import { Candle } from "../modles/candle";

export function sortCandlesByDate(candles: Candle[]): Candle[] {
  const sorted = [...candles].sort((a, b) => {
    if (a.date > b.date) {
      return 1;
    } else if (a.date < b.date) {
      return -1;
    }
    return 0;
  });

  return sorted;
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}
