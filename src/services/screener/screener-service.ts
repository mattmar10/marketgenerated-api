import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { DailyCacheService } from "../daily_cache_service";
import {
  TrendTemplateResult,
  TrendTemplateResults,
} from "../../controllers/screener/screener-responses";
import { httpGet } from "inversify-express-utils";
import { Ticker } from "../../MarketGeneratedTypes";
import { Candle } from "../../modles/candle";
import { filterCandlesPast52Weeks } from "../../indicators/indicator-utils";
import { sortCandlesByDate } from "../../utils/basic_utils";
import {
  calculateLinearRegressionFromNumbers,
  isLinearRegressionResult,
} from "../../indicators/linear-regression";
import {
  isMovingAverageError,
  sma,
  smaSeq,
} from "../../indicators/moving-average";

export interface TrendTemplateError {
  symbol: Ticker;
  error: string;
}

function isTrendTemplateError(value: any): value is TrendTemplateError {
  return (
    typeof value === "object" &&
    value !== null &&
    "symbol" in value &&
    "error" in value
  );
}

function passesTrendTemplateCriteria(ttr: TrendTemplateResult): boolean {
  const lowThreshold = ttr.fiftyTwoWeekLow + 0.3 * ttr.fiftyTwoWeekLow;
  const highThreshold = ttr.fiftyTwoWeekHigh - 0.25 * ttr.fiftyTwoWeekHigh;

  return (
    ttr.lastClose > ttr.fiftyMA &&
    ttr.fiftyMA > ttr.oneFiftyMA &&
    ttr.oneFiftyMA > ttr.twoHundredMA &&
    ttr.twoHudredMALRSlope > 0 &&
    ttr.lastClose > lowThreshold &&
    ttr.lastClose > highThreshold
  );
}

@injectable()
export class ScreenerService {
  private trendTemplateResults: TrendTemplateResults | undefined = undefined;

  private MIN_CLOSE_PRICE: number = 10.0;

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService
  ) {
    this.trendTemplateResults = this.buildTrendTemplateResults();
  }

  public getTrendTemplateResults(): TrendTemplateResults | undefined {
    return this.trendTemplateResults;
  }

  private buildTrendTemplateResults(): TrendTemplateResults {
    const cached = this.cacheSvc.getAllData();
    const allKeys = cached.keys();

    const trendTemplateSuccesses: TrendTemplateResult[] = [];
    const trendTemplateErrors: TrendTemplateError[] = [];

    for (const k of allKeys) {
      const candles = this.cacheSvc.getCandles(k);
      const sorted = sortCandlesByDate(candles);

      if (sorted[sorted.length - 1].close < this.MIN_CLOSE_PRICE) {
        continue;
      }

      const trendTemplateResult = this.buildTrendTemplateResult(k, sorted);

      if (isTrendTemplateError(trendTemplateResult)) {
        trendTemplateErrors.push(trendTemplateResult);
      } else if (passesTrendTemplateCriteria(trendTemplateResult)) {
        trendTemplateSuccesses.push(trendTemplateResult);
      }
    }
    const trendTemplateResults: TrendTemplateResults = {
      results: trendTemplateSuccesses,
    };

    return trendTemplateResults;
  }

  private buildTrendTemplateResult(
    ticker: Ticker,
    candles: Candle[]
  ): TrendTemplateError | TrendTemplateResult {
    const filtered = filterCandlesPast52Weeks(candles);

    if (!filtered || filtered.length <= 200) {
      const err: TrendTemplateError = {
        symbol: ticker,
        error: "Not enough candles to calculate trend template",
      };

      return err;
    }

    const closes = filtered.map((c) => c.close);
    const fiftyTwoWeekLow = Math.min(...closes);
    const fiftyTwoWeekHigh = Math.max(...closes);

    const twoHundredSMA = sma(200, closes);

    const allSorted = sortCandlesByDate(candles).map((c) => c.close);
    const twoHundredSMASeq = smaSeq(200, allSorted);

    if (isMovingAverageError(twoHundredSMASeq)) {
      const err: TrendTemplateError = {
        symbol: ticker,
        error: "Not enough candles to calculate 200 MA",
      };

      return err;
    }

    const lastThirty = twoHundredSMASeq.slice(-30);
    const linearReg = calculateLinearRegressionFromNumbers(lastThirty, 30);

    if (!isLinearRegressionResult(linearReg)) {
      const err: TrendTemplateError = {
        symbol: ticker,
        error: "Error calculating linear regression of 200MA",
      };

      return err;
    }

    const oneFiftySMA = sma(150, closes);
    const fiftySMA = sma(50, closes);

    if (
      isMovingAverageError(twoHundredSMA) ||
      isMovingAverageError(oneFiftySMA) ||
      isMovingAverageError(fiftySMA)
    ) {
      const err: TrendTemplateError = {
        symbol: ticker,
        error: "error calculating Moving averages",
      };

      return err;
    }

    const result: TrendTemplateResult = {
      symbol: ticker,
      lastClose: closes[closes.length - 1],
      twoHundredMA: twoHundredSMA,
      oneFiftyMA: oneFiftySMA,
      fiftyMA: fiftySMA,
      twoHudredMALRSlope: linearReg.slope,
      fiftyTwoWeekHigh: fiftyTwoWeekHigh,
      fiftyTwoWeekLow: fiftyTwoWeekLow,
    };

    return result;
  }
}
