import { expect } from "chai";
import { Candle } from "../../src/modles/candle";
import { calculatePercentageReturn } from "../../src/indicators/indicator-utils";

describe("beta", () => {
  it("should return an IndicatorError when there are no candles", () => {
    const candles: Candle[] = [];
    const result = calculatePercentageReturn(candles);
    expect(result).to.be.a("string");
  });
});
