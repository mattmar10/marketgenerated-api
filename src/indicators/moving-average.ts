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
