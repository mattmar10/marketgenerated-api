import { Candle } from "../modles/candle";
import { LinePoint } from "./linep-point-types";

export type MovingAverageType = "SMA" | "EMA";

export interface MovingAverageError {
  movingAvgType: MovingAverageType;
  error: string;
}

export function isMovingAverageError(value: any): value is MovingAverageError {
  return (
    typeof value === "object" &&
    value !== null &&
    "movingAvgType" in value &&
    "error" in value
  );
}

export function ema(
  period: number,
  data: number[]
): MovingAverageError | number {
  if (data.length < period) {
    return {
      movingAvgType: "EMA",
      error: "Not enough data",
    };
  } else {
    const alpha = 2 / (period + 1);
    let ema = data[0]; // Initialize EMA with the first data point

    for (let i = 1; i < data.length; i++) {
      ema = alpha * data[i] + (1 - alpha) * ema;
    }

    return ema;
  }
}

export function sma(
  period: number,
  data: number[]
): MovingAverageError | number {
  if (data.length < period) {
    return {
      movingAvgType: "SMA",
      error: "Not enough data",
    };
  } else {
    const sliced = data.slice(-period);
    const sum = sliced.reduce((acc, num) => acc + num, 0);

    return sum / sliced.length;
  }
}

export function smaSeries(period: number, candles: Candle[]): LinePoint[] {
  const result = new Array<LinePoint>(candles.length);
  let sum = 0;

  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;

    if (i >= period) {
      sum -= candles[i - period].close;

      const point: LinePoint = {
        time: candles[i].dateStr!,
        value: sum / period,
      };

      result[i] = point;
    } else {
      const point: LinePoint = {
        time: candles[i].dateStr!,
        value: sum / (i + 1),
      };
      result[i] = point;
    }
  }

  return result;
}

export interface MovingAverageLine {
  period: number;
  timeseries: LinePoint[];
}

export function calculateSMA(
  candles: Candle[],
  period: number
): MovingAverageLine | MovingAverageError {
  if (candles.length < period) {
    return {
      movingAvgType: "SMA",
      error: "Not enough data to calculate SMA",
    };
  }

  const smaData = [];

  for (let i = period - 1; i < candles.length; i++) {
    const sum = candles
      .slice(i - period + 1, i + 1)
      .reduce((total, c) => total + c.close, 0);

    const average = sum / period;
    smaData.push({ time: candles[i].dateStr!, value: average });
  }

  return {
    period: period,
    timeseries: smaData,
  };
}

export function calculateEMA(
  candles: Candle[],
  period: number
): MovingAverageLine | MovingAverageError {
  if (candles.length < period) {
    return {
      movingAvgType: "EMA",
      error: "Not enough data to calculate EMA",
    };
  }

  const multiplier = 2 / (period + 1);

  const emaData = [];
  let ema =
    candles.slice(0, period).reduce((sum, c) => sum + c.close, 0) / period;

  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
    emaData.push({ time: candles[i].dateStr!, value: ema });
  }

  return {
    period: period,
    timeseries: emaData,
  };
}

export function smaSeq(
  period: number,
  data: number[]
): MovingAverageError | number[] {
  if (data.length < period) {
    return {
      movingAvgType: "SMA",
      error: "Not enough data to calculate SMA",
    };
  } else {
    const smaSeq: number[] = [];
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      if (i >= period - 1) {
        smaSeq.push(sum / period);
        sum -= data[i - (period - 1)];
      }
    }

    return smaSeq;
  }
}
