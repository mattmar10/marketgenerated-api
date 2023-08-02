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
import { RelativeStrengthService } from "../relative-strength/relative-strength-service";
import { SymbolService } from "../symbol_service";

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
    //ttr.lastClose > ttr.fiftyMA &&
    ttr.fiftyMA > ttr.oneFiftyMA &&
    ttr.oneFiftyMA > ttr.twoHundredMA &&
    ttr.twoHudredMALRSlope > 0 &&
    ttr.lastClose > lowThreshold &&
    ttr.lastClose > highThreshold &&
    ttr.compositeRelativeStrength > 50
  );
}

@injectable()
export class ScreenerService {
  private trendTemplateResults: TrendTemplateResults | undefined = undefined;

  private MIN_CLOSE_PRICE: number = 10.0;

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService,
    @inject(TYPES.RelativeStrengthService)
    private relativeStrengthSvc: RelativeStrengthService
  ) {
    this.trendTemplateResults = this.buildTrendTemplateResults();
  }

  public getTrendTemplateResults(): TrendTemplateResults | undefined {
    return this.trendTemplateResults;
  }

  private buildTrendTemplateResults(): TrendTemplateResults {
    const cached = this.cacheSvc.getAllData();
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();

    const universeOfStockKeys = stocks.map((s) => s.Symbol);
    const universeOfEtfKeys = etfs.map((e) => e.Symbol);

    const allKeys = Array.from(cached.keys()).filter(
      (k) => universeOfStockKeys.includes(k) || universeOfEtfKeys.includes(k)
    );

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

    const sorted = [...trendTemplateSuccesses].sort(
      (a, b) => b.compositeRelativeStrength - a.compositeRelativeStrength
    );

    const trendTemplateResults: TrendTemplateResults = {
      results: sorted,
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

    const lastNinety = twoHundredSMASeq.slice(-90);
    const linearReg = calculateLinearRegressionFromNumbers(lastNinety, 90);

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

    const relativeStrengthRes =
      this.relativeStrengthSvc.getCompositeRelativeStrengthForSymbol(ticker);

    const lastClose = Number(closes[closes.length - 1].toFixed(2));

    const percentageAwayFromFiftyMA = ((lastClose - fiftySMA) / fiftySMA) * 100;

    const result: TrendTemplateResult = {
      symbol: ticker,
      lastClose: Number(lastClose.toFixed(2)),
      twoHundredMA: Number(twoHundredSMA.toFixed(2)),
      oneFiftyMA: Number(oneFiftySMA.toFixed(2)),
      fiftyMA: Number(fiftySMA.toFixed(2)),
      twoHudredMALRSlope: Number(linearReg.slope.toFixed(2)),
      fiftyTwoWeekHigh: Number(fiftyTwoWeekHigh.toFixed(2)),
      fiftyTwoWeekLow: Number(fiftyTwoWeekLow.toFixed(2)),
      compositeRelativeStrength: Number(relativeStrengthRes.toFixed(2)),
      percentFrom50MA: Number(percentageAwayFromFiftyMA.toFixed(2)),
    };

    return result;
  }
}
