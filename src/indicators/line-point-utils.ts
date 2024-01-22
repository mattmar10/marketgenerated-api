import { Candle } from "../modles/candle";
import { LinePoint } from "./linep-point-types";
import { smaSeries } from "./moving-average";

export function add(values1: LinePoint[], values2: LinePoint[]): LinePoint[] {
  checkSameLength<LinePoint>(values1, values2);

  const result = new Array<LinePoint>(values1.length);

  for (let i = 0; i < values1.length; i++) {
    const point: LinePoint = {
      time: values1[i].time,
      value: values1[i].value + values2[i].value,
    };
    result[i] = point;
  }

  return result;
}

export function subtract(
  values1: LinePoint[],
  values2: LinePoint[]
): LinePoint[] {
  checkSameLength<LinePoint>(values1, values2);

  const result = new Array<LinePoint>(values1.length);

  for (let i = 0; i < values1.length; i++) {
    const point: LinePoint = {
      time: values1[i].time,
      value: values1[i].value - values2[i].value,
    };
    result[i] = point;
  }

  return result;
}

export function checkSameLength<T>(...values: T[][]): void {
  if (values.length > 0) {
    const length = values[0].length;

    for (let i = 1; i < values.length; i++) {
      if (values[i].length !== length) {
        throw new Error(`values length at ${i} not ${length}`);
      }
    }
  }
}

export function multiply(values1: number[], values2: number[]): number[] {
  checkSameLength(values1, values2);

  const result = new Array<number>(values1.length);

  for (let i = 0; i < values1.length; i++) {
    result[i] = values1[i] * values2[i];
  }

  return result;
}

export function multiplyBy(n: number, values: LinePoint[]): LinePoint[] {
  const result = new Array<LinePoint>(values.length);

  for (let i = 0; i < values.length; i++) {
    const point: LinePoint = {
      time: values[i].time!,
      value: values[i].value * n,
    };
    result[i] = point;
  }

  return result;
}

export function stdSeries(period: number, candles: Candle[]): LinePoint[] {
  const result = new Array<LinePoint>(candles.length);
  const averages = smaSeries(period, candles);

  for (let i = 0; i < candles.length; i++) {
    result[i] = {
      time: candles[i].dateStr!,
      value: 0,
    };

    if (i >= period - 1) {
      let sum = 0;

      for (let k = i - (period - 1); k <= i; k++) {
        sum +=
          (candles[k].close - averages[i].value) *
          (candles[k].close - averages[i].value);
      }

      result[i].value = Math.sqrt(sum / period);
    }
  }

  return result;
}
