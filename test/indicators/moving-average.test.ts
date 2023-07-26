import { expect } from "chai";

import {
  sma,
  MovingAverageError,
  smaSeq,
} from "../../src/indicators/moving-average";

describe("SMA (Simple Moving Average) Function", () => {
  it("should return the correct SMA when there is enough data", () => {
    const period = 5;
    const data = [10, 20, 30, 40, 50];

    const result = sma(period, data);

    // Calculate the expected SMA manually
    const expectedSMA = (10 + 20 + 30 + 40 + 50) / 5;

    expect(result).to.be.a("number");
    expect(result).to.equal(expectedSMA);
  });

  it("should return a MovingAverageError when there is not enough data", () => {
    const period = 10;
    const data = [10, 20, 30, 40, 50];

    const result = sma(period, data);

    const expectedError: MovingAverageError = {
      movingAvgType: "SMA",
      error: "Not enough data",
    };

    expect(result).to.deep.equal(expectedError);
  });

  it("should return MovingAverageError when data length is less than period", () => {
    const period = 5;
    const data = [1, 2, 3, 4];
    const result = smaSeq(period, data);

    expect(result).to.deep.equal({
      movingAvgType: "SMA",
      error: "Not enough data to calculate SMA",
    } as MovingAverageError);
  });

  it("should return the correct simple moving average", () => {
    const period = 3;
    const data = [5, 10, 15, 20, 25];
    const result = smaSeq(period, data);

    // Calculate the expected SMA for each subarray of 'period' length in 'data'
    const expectedSmaSeq = [10, 15, 20];

    expect(result).to.deep.equal(expectedSmaSeq);
  });

  it("should handle an empty data array", () => {
    const period = 5;
    const data: number[] = [];
    const result = smaSeq(period, data);

    expect(result).to.deep.equal({
      movingAvgType: "SMA",
      error: "Not enough data to calculate SMA",
    } as MovingAverageError);
  });
});
