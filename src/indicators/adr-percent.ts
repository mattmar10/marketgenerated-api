import { Candle } from "../modles/candle";
import { LinePoint } from "./linep-point-types";

export type ADRPercentError = {
  errorMessage: string;
};

// Type guard function
export function isADRPercentError(error: any): error is ADRPercentError {
  return typeof error === "object" && error !== null && "errorMessage" in error;
}

export function adrPercent(
  candles: Candle[],
  period: number
): number | ADRPercentError {
  if (candles.length < period) {
    return {
      errorMessage: `Not enough candles: ${candles.length} < ${period}}`,
    };
  }

  const sorted = [...candles].sort((a, b) => {
    if (a.date > b.date) {
      return 1;
    } else if (a.date < b.date) {
      return -1;
    }
    return 0;
  });

  const window = sorted.slice(-period);
  const mapped = window.map((c) => {
    if (!c.close || c.close == 0) {
      return 0;
    }

    return 100 * ((c.high - c.low) / c.close);
  });

  return findMean(mapped);
}

export function adrPercentSeq(
  candles: Candle[],
  period: number
): LinePoint[] | ADRPercentError {
  if (candles.length < period) {
    return {
      errorMessage: `Not enough candles: ${candles.length} < ${period}`,
    };
  }

  // Sort candles by date
  const sorted = [...candles].sort((a, b) => {
    if (a.date > b.date) {
      return 1;
    } else if (a.date < b.date) {
      return -1;
    }
    return 0;
  });

  const timeseries: LinePoint[] = [];

  for (let i = period; i <= sorted.length; i++) {
    const window = sorted.slice(i - period, i);
    const mapped = window.map((c) => {
      if (!c.close || c.close == 0) {
        return 0;
      }
      return 100 * ((c.high - c.low) / c.close);
    });

    const meanValue = findMean(mapped);
    const lastCandle = window[window.length - 1];

    timeseries.push({
      time: lastCandle.dateStr!,
      value: meanValue,
    });
  }

  return timeseries;
}

export const findMean = (numbers: number[]): number => {
  if (numbers.length === 0) {
    return 0;
  }
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  const mean = sum / numbers.length;
  return mean;
};
