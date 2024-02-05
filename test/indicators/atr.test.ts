import { deepStrictEqual } from "assert";
import { Candle } from "../../src/modles/candle";
import { atr } from "../../src/indicators/atr";

describe("ATR", () => {
  it("should be able to compute the atr", () => {
    const candles: Candle[] = [
      {
        dateStr: "1",
        date: 1,
        close: 81.59,
        high: 82.15,
        low: 81.29,
        open: 3,
        volume: 1,
      },
      {
        dateStr: "2",
        date: 2,
        volume: 2,
        close: 81.06,
        high: 81.89,
        low: 80.64,
        open: 3,
      },
      {
        dateStr: "3",
        date: 3,
        volume: 3,
        close: 82.87,
        high: 83.03,
        low: 81.31,
        open: 3,
      },
      {
        dateStr: "4",
        date: 4,
        volume: 4,
        close: 83.0,
        high: 83.3,
        low: 82.65,
        open: 3,
      },
      {
        dateStr: "5",
        date: 5,
        volume: 5,
        close: 83.61,
        high: 83.85,
        low: 83.07,
        open: 3,
      },
      {
        dateStr: "6",
        date: 6,
        volume: 6,
        close: 83.15,
        high: 83.9,
        low: 83.11,
        open: 3,
      },
      {
        dateStr: "7",
        date: 7,
        volume: 7,
        close: 82.84,
        high: 83.33,
        low: 82.49,
        open: 3,
      },
      {
        dateStr: "8",
        date: 8,
        volume: 8,
        close: 83.99,
        high: 84.3,
        low: 82.3,
        open: 3,
      },
      {
        dateStr: "9",
        date: 9,
        volume: 9,
        close: 84.55,
        high: 84.84,
        low: 84.15,
        open: 3,
      },
      {
        dateStr: "10",
        date: 10,
        volume: 10,
        close: 84.36,
        high: 85.0,
        low: 84.11,
        open: 3,
      },
      {
        dateStr: "11",
        date: 11,
        volume: 11,
        close: 85.53,
        high: 85.9,
        low: 84.03,
        open: 3,
      },
      {
        dateStr: "12",
        date: 12,
        volume: 12,
        close: 86.54,
        high: 86.58,
        low: 85.39,
        open: 3,
      },
      {
        dateStr: "13",
        date: 13,
        volume: 13,
        close: 86.89,
        high: 86.98,
        low: 85.76,
        open: 3,
      },
      {
        dateStr: "14",
        date: 14,
        volume: 14,
        close: 87.77,
        high: 88.0,
        low: 87.17,
        open: 3,
      },
      {
        dateStr: "15",
        date: 15,
        volume: 15,
        close: 87.29,
        high: 87.87,
        low: 87.01,
        open: 3,
      },
    ];

    const expectations = [
      1.12, 1.05, 1.01, 1.21, 1.14, 1.09, 1.24, 1.23, 1.23, 1.21, 1.14,
    ];

    const result = atr(candles, 5);

    const mapped = result.timeseries.map((l) => l.value);

    //const actual = calulateBollingerBands(closings);
    deepStrictEqual(mapped, expectations);
  });
});
