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
    const multiplier = 2 / (period + 1);

    // Calculate the initial EMA as the simple moving average of the first 'period' values
    let initialEma = 0;
    for (let i = 0; i < period; i++) {
      initialEma += data[i];
    }
    initialEma /= period;

    // Calculate the subsequent EMAs using the formula: EMA_today = (close_today - EMA_yesterday) * multiplier + EMA_yesterday
    let ema = initialEma;
    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }

    return ema;
  }
}

export function emaSeq(
  period: number,
  data: number[]
): MovingAverageError | number[] {
  if (data.length < period) {
    return {
      movingAvgType: "EMA",
      error: "Not enough data to calculate EMA",
    };
  } else {
    const emaSeq: number[] = [];
    const multiplier = 2 / (period + 1);
    let ema = 0;

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        emaSeq.push(0); // Fill with zeros for the initial period
        ema += data[i];
      } else if (i === period - 1) {
        ema += data[i];
        emaSeq.push(ema / period);
      } else {
        ema = (data[i] - ema) * multiplier + ema;
        emaSeq.push(ema);
      }

      if (i >= period) {
        ema -= data[i - (period - 1)];
      }
    }

    return emaSeq;
  }
}
