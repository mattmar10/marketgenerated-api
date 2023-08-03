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
import { isString, sortCandlesByDate } from "../../utils/basic_utils";
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
import { calculateMean } from "../../utils/math_utils";

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
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();

    const trendTemplateErrors: TrendTemplateError[] = [];
    const stockResults: TrendTemplateResult[] = [];
    const etfResults: TrendTemplateResult[] = [];

    // Combine the loops for stocks and ETFs
    for (const symbolData of [...stocks, ...etfs]) {
      const symbol = symbolData.Symbol;
      const candles = this.cacheSvc.getCandles(symbol);

      if (!candles || candles.length === 0) {
        continue;
      }

      const sorted = sortCandlesByDate(candles);

      if (sorted[sorted.length - 1].close < this.MIN_CLOSE_PRICE) {
        continue;
      }

      const companyName = symbolData.companyName;
      const trendTemplateResult = this.buildTrendTemplateResult(
        symbol,
        companyName,
        sorted
      );

      if (isTrendTemplateError(trendTemplateResult)) {
        trendTemplateErrors.push(trendTemplateResult);
      } else if (passesTrendTemplateCriteria(trendTemplateResult)) {
        if (symbolData.isEtf) {
          etfResults.push(trendTemplateResult);
        } else {
          stockResults.push(trendTemplateResult);
        }
      }
    }

    // Sort the results arrays in descending order based on compositeRelativeStrength
    const sortedStocks = [...stockResults].sort(
      (a, b) => b.compositeRelativeStrength - a.compositeRelativeStrength
    );

    const sortedEtfs = [...etfResults].sort(
      (a, b) => b.compositeRelativeStrength - a.compositeRelativeStrength
    );

    const trendTemplateResults: TrendTemplateResults = {
      lastDate: this.cacheSvc.getLastDate()!,
      stocks: sortedStocks,
      etfs: sortedEtfs,
    };

    return trendTemplateResults;
  }

  private buildTrendTemplateResult(
    ticker: Ticker,
    name: string,
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

    const volumes = filtered.map((c) => c.volume);
    const ranges = filtered.map((c) => c.high - c.low);

    const lastTwentyVolumes = volumes.slice(-20);
    const lastTwentyRanges = ranges.slice(-20);

    const avgVolume = calculateMean(lastTwentyVolumes);
    const avgRange = calculateMean(lastTwentyRanges);
    const linearRegressionVolume = calculateLinearRegressionFromNumbers(
      lastTwentyVolumes,
      20
    );
    const linearRegressionVolatility = calculateLinearRegressionFromNumbers(
      lastTwentyRanges,
      20
    );

    const lastVolume = volumes[volumes.length - 1];
    const lastRange = ranges[ranges.length - 1];

    if (
      isMovingAverageError(twoHundredSMA) ||
      isMovingAverageError(oneFiftySMA) ||
      isMovingAverageError(fiftySMA) ||
      isString(linearRegressionVolatility) ||
      isString(linearRegressionVolume)
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
      name: name,
      lastClose: Number(lastClose.toFixed(2)),
      lastVolume: lastVolume,
      twoHundredMA: Number(twoHundredSMA.toFixed(2)),
      oneFiftyMA: Number(oneFiftySMA.toFixed(2)),
      fiftyMA: Number(fiftySMA.toFixed(2)),
      twoHudredMALRSlope: Number(linearReg.slope.toFixed(2)),
      fiftyTwoWeekHigh: Number(fiftyTwoWeekHigh.toFixed(2)),
      fiftyTwoWeekLow: Number(fiftyTwoWeekLow.toFixed(2)),
      compositeRelativeStrength: Number(relativeStrengthRes.toFixed(2)),
      percentFrom50MA: Number(percentageAwayFromFiftyMA.toFixed(2)),
      lastTwentyAvgVolume: Number(avgVolume?.toFixed(2)),
      lastDailyRange: Number(lastRange.toFixed(2)),
      lastTwentyVolumeLinearRegressionSlope: Number(
        linearRegressionVolume.slope.toFixed(2)
      ),
      lastTwentyAvgDailyRange: Number(avgRange?.toFixed(2)),
      lastTwentDailyRangeLinearRegressionSlope: Number(
        linearRegressionVolatility.slope.toFixed(2)
      ),
    };

    return result;
  }
}
