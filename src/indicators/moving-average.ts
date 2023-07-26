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
