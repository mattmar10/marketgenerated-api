export interface DataPoint {
  x: number;
  y: number;
}

export interface LinearRegressionResult {
  slope: number;
  yIntercept: number;
}

export type LinearRegressionError = string;

export function isLinearRegressionResult(
  value: any
): value is LinearRegressionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "slope" in value &&
    "yIntercept" in value &&
    typeof value.slope === "number" &&
    typeof value.yIntercept === "number"
  );
}

export function calculateLinearRegressionFromNumbers(
  data: number[],
  period: number
): LinearRegressionResult | LinearRegressionError {
  const n = data.length;

  if (n < period) {
    return "Input data is not sufficient";
  }

  const mapped: DataPoint[] = [];

  // Create data points with x values starting from 1 and y values from the input data
  for (let i = n - period; i < n; i++) {
    const dataPoint: DataPoint = {
      x: i - (n - period) + 1, // x values start from 1
      y: data[i],
    };
    mapped.push(dataPoint);
  }

  return calculateLinearRegression(mapped, period);
}

export function calculateLinearRegression(
  input: DataPoint[],
  period: number
): LinearRegressionResult | LinearRegressionError {
  const n = input.length;

  if (n < period) {
    return "Input data is not sufficient";
  }

  const data = input.slice(-period);

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const point of data) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumX2 += point.x ** 2;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
  const yIntercept = (sumY - slope * sumX) / n;

  return { slope, yIntercept };
}
