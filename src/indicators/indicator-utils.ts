import { Candle } from "../modles/candle";

export type IndicatorError = string;
export function isIndicatorError(
  value: number | IndicatorError
): value is IndicatorError {
  return typeof value === "string";
}

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

export function filterCandlesYearToDate(candles: Candle[]): Candle[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Get the start of the year
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const sorted = [...candles].sort((a, b) => {
    if (a.date > b.date) {
      return 1;
    } else if (a.date < b.date) {
      return -1;
    }
    return 0;
  });

  return sorted.filter((candle) => {
    return candle.date >= startOfYear.getTime() && candle.date <= now.getTime();
  });
}

export function filterCandlesPastMonths(
  candles: Candle[],
  monthsAgo: number
): Candle[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Calculate the date "monthsAgo" from now
  let fromMonth = now.getMonth() - monthsAgo;
  let fromYear = now.getFullYear();
  if (fromMonth < 0) {
    fromMonth += 12;
    fromYear -= 1;
  }
  const targetDate = new Date(fromYear, fromMonth, now.getDate());

  const filteredCandles = candles.filter((candle) => {
    const candleDate = new Date(candle.date);
    candleDate.setHours(0, 0, 0, 0);
    return candleDate >= targetDate && candleDate <= now;
  });

  return filteredCandles;
}

export function filterCandlesPastWeeks(
  candles: Candle[],
  weeksAgo: number
): Candle[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Calculate the date "weeksAgo" from now
  const fromTimestamp = now.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000;
  const targetDate = new Date(fromTimestamp);

  const filteredCandles = candles.filter((candle) => {
    const candleDate = new Date(candle.date);
    candleDate.setHours(0, 0, 0, 0);
    return candleDate >= targetDate && candleDate <= now;
  });

  return filteredCandles;
}

export function internalBarStrength(candle: Candle): number {
  return (candle.close - candle.low) / (candle.high - candle.low);
}

export function calculatePercentageReturn(
  candles: Candle[]
): number | IndicatorError {
  const numCandles = candles.length;

  if (numCandles <= 1) {
    return "Not enough candles to calculate a return";
  }

  const startingPrice = candles[0].close;
  const endingPrice = candles[numCandles - 1].close;

  const percentageReturn =
    ((endingPrice - startingPrice) / startingPrice) * 100;
  return percentageReturn;
}
