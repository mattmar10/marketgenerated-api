import { expect } from "chai";

import {
  DataPoint,
  LinearRegressionResult,
  calculateLinearRegression,
  calculateLinearRegressionFromNumbers,
} from "../../src/indicators/linear-regression";

describe("Linear Regression", () => {
  it("should calculate the correct linear regression", () => {
    const data: DataPoint[] = [
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 5 },
      { x: 5, y: 6 },
    ];

    const period = 5;
    const expected: LinearRegressionResult = {
      slope: 1,
      yIntercept: 1,
    };

    const result = calculateLinearRegression(data, period);
    expect(result).to.deep.equal(expected);
  });

  it("should calculate the correct linear regression with a positive slope", () => {
    const data: DataPoint[] = [
      { x: 1, y: 34 },
      { x: 2, y: 43 },
      { x: 3, y: 51 },
      { x: 4, y: 49 },
      { x: 5, y: 59 },
      { x: 6, y: 65 },
      { x: 7, y: 73 },
    ];

    const period = 7;
    const expected: LinearRegressionResult = {
      slope: 6.035714285714286,
      yIntercept: 29.285714285714285,
    };

    const result = calculateLinearRegression(data, period);
    expect(result).to.deep.equal(expected);
  });

  it("should calculate the correct linear regression from just numbers", () => {
    const data: number[] = [34, 43, 51, 49, 59, 65, 73];

    const period = 7;
    const expected: LinearRegressionResult = {
      slope: 6.035714285714286,
      yIntercept: 29.285714285714285,
    };

    const result = calculateLinearRegressionFromNumbers(data, period);
    expect(result).to.deep.equal(expected);
  });

  it("should return an error for insufficient input data", () => {
    const data: DataPoint[] = [
      { x: 1, y: 2 },
      { x: 2, y: 3 },
    ];

    const period = 5;
    const expectedError = "Input data is not sufficient";

    const result = calculateLinearRegression(data, period);
    expect(result).to.equal(expectedError);
  });
});
