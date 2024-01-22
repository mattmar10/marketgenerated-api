import { Candle } from "../../src/modles/candle";
import { calculatePercentageReturn } from "../../src/indicators/indicator-utils";
import { expect } from "chai";

describe("calculatePercentageReturn", () => {
  it("should return an IndicatorError when there are no candles", () => {
    const candles: Candle[] = [];
    const result = calculatePercentageReturn(candles);
    expect(result).to.be.a("string");
  });

  it("should return an IndicatorError when there is only one candle", () => {
    const candles: Candle[] = [
      {
        date: 1,
        dateStr: "",
        open: 100,
        high: 150,
        low: 80,
        close: 120,
        volume: 1000,
      },
    ];
    const result = calculatePercentageReturn(candles);
    expect(result).to.be.a("string");
  });

  it("should calculate the percentage return for two candles", () => {
    const candles: Candle[] = [
      {
        date: 1,
        dateStr: "",
        open: 100,
        high: 150,
        low: 80,
        close: 120,
        volume: 1000,
      },
      {
        date: 2,
        dateStr: "",
        open: 120,
        high: 200,
        low: 110,
        close: 180,
        volume: 1500,
      },
    ];
    const result = calculatePercentageReturn(candles);
    expect(result).to.be.closeTo(50, 1e-9); // Assuming a percentage return of 50%
  });
});
