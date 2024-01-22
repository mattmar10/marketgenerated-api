import { deepStrictEqual } from "assert";
import { Candle } from "../../src/modles/candle";
import { bollingerBands } from "../../src/indicators/bollinger-bands";
import { roundDigitsAll } from "../../src/utils/math_utils";

describe("Bollinger Bands", () => {
  it("should be able to compute the bollinger bands", () => {
    const closings = [
      2, 4, 6, 8, 12, 14, 16, 18, 20, 2, 4, 6, 8, 12, 14, 16, 18, 20, 2, 4, 6,
      8, 12, 14, 16, 18, 20, 2, 4, 6, 8, 12, 14, 16, 18, 20,
    ];

    const startDate = new Date();
    const daysIncrement = 1;

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const generateTestCandles = (
      closings: number[],
      startDate: Date,
      daysIncrement: number
    ): Candle[] => {
      let currentDate = new Date(startDate);
      return closings.map((close, index) => {
        const candle: Candle = {
          date: currentDate.getTime(),
          dateStr: formatDate(currentDate),
          open: close - 1,
          high: close + 1,
          low: close - 2,
          close,
          volume: 1000, // Set a default volume for the example
        };

        currentDate.setDate(currentDate.getDate() + daysIncrement);

        return candle;
      });
    };

    const testCandles = generateTestCandles(closings, startDate, daysIncrement);
    const bollinger = bollingerBands(testCandles, 20, 2);
    const upper = bollinger.timeseries.map((b) => b.upperBand);
    const mid = bollinger.timeseries.map((b) => b.sma);
    const lower = bollinger.timeseries.map((b) => b.lowerBand);

    const expectedUpperBand = [
      2, 3, 4, 5, 6.4, 7.67, 8.86, 10, 11.11, 10.2, 9.64, 9.33, 9.23, 9.43,
      9.73, 10.13, 10.59, 11.11, 10.63, 22.78, 22.56, 22.45, 22.56, 22.84,
      23.22, 23.72, 24.32, 23.9, 22.78, 22.56, 22.45, 22.56, 22.84, 23.22,
      23.72, 24.32,
    ];

    const expectedMiddleBand = [
      2, 3, 4, 5, 6.4, 7.67, 8.86, 10, 11.11, 10.2, 9.64, 9.33, 9.23, 9.43,
      9.73, 10.13, 10.59, 11.11, 10.63, 10.3, 10.5, 10.7, 11, 11.3, 11.5, 11.7,
      11.9, 11.1, 10.3, 10.5, 10.7, 11, 11.3, 11.5, 11.7, 11.9,
    ];

    const expectedLowerBand = [
      2, 3, 4, 5, 6.4, 7.67, 8.86, 10, 11.11, 10.2, 9.64, 9.33, 9.23, 9.43,
      9.73, 10.13, 10.59, 11.11, 10.63, -2.18, -1.56, -1.05, -0.56, -0.24,
      -0.22, -0.32, -0.52, -1.7, -2.18, -1.56, -1.05, -0.56, -0.24, -0.22,
      -0.32, -0.52,
    ];

    //const actual = calulateBollingerBands(closings);
    deepStrictEqual(roundDigitsAll(2, upper), expectedUpperBand);
    deepStrictEqual(roundDigitsAll(2, mid), expectedMiddleBand);
    deepStrictEqual(roundDigitsAll(2, lower), expectedLowerBand);
  });
});
