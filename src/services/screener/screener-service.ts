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
import {
  filterCandlesPast52Weeks,
  filterCandlesPastWeeks,
  internalBarStrength,
} from "../../indicators/indicator-utils";
import { isString, sortCandlesByDate } from "../../utils/basic_utils";
import {
  calculateLinearRegressionFromNumbers,
  isLinearRegressionResult,
} from "../../indicators/linear-regression";
import {
  ema,
  isMovingAverageError,
  sma,
  smaSeq,
} from "../../indicators/moving-average";
import { RelativeStrengthService } from "../relative-strength/relative-strength-service";
import { SymbolService } from "../symbol/symbol_service";
import { calculateMean } from "../../utils/math_utils";
import { getRelativeStrengthLine } from "../../indicators/relative-strength";
import { min } from "moment";
import {
  RelativeStrengthError,
  RelativeStrengthsForSymbolStats,
  isRelativeStrengthError,
  isRelativeStrengthsForSymbol,
} from "../relative-strength/relative-strength-types";
import { GapUpOnVolumeScreenerResult, ScreenerResult } from "./screener-types";

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
    ttr.compositeRelativeStrength > 75
  );
}

function passesShortTermTrendTemplateCriteria(
  ttr: TrendTemplateResult
): boolean {
  const lowThreshold = ttr.fiftyTwoWeekLow + 0.3 * ttr.fiftyTwoWeekLow;
  const highThreshold = ttr.fiftyTwoWeekHigh - 0.25 * ttr.fiftyTwoWeekHigh;

  return (
    ttr.lastClose > ttr.fiftyMA &&
    ttr.fiftyMA > ttr.oneFiftyMA &&
    ttr.oneFiftyMA > ttr.twoHundredMA &&
    ttr.twoHudredMALRSlope > 0 &&
    ttr.lastClose > lowThreshold &&
    ttr.lastClose > highThreshold &&
    ttr.compositeRelativeStrength > 75
  );
}

@injectable()
export class ScreenerService {
  private longTermtrendTemplateResults: TrendTemplateResults | undefined =
    undefined;
  private shortTermtrendTemplateResults: TrendTemplateResults | undefined =
    undefined;

  private MIN_CLOSE_PRICE: number = 5.0;

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService,
    @inject(TYPES.RelativeStrengthService)
    private relativeStrengthSvc: RelativeStrengthService
  ) {
    this.longTermtrendTemplateResults = this.buildTrendTemplateResults();
    this.shortTermtrendTemplateResults =
      this.buildShortTermTrendTemplateResults();
  }

  public getLongTermTrendTemplateResults(): TrendTemplateResults | undefined {
    return this.longTermtrendTemplateResults;
  }

  public getShortTermTrendTemplateResults(): TrendTemplateResults | undefined {
    return this.shortTermtrendTemplateResults;
  }

  private buildTrendTemplateResults(): TrendTemplateResults {
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();

    const trendTemplateErrors: TrendTemplateError[] = [];
    const longTermStockResults: TrendTemplateResult[] = [];
    const longTermEtfResults: TrendTemplateResult[] = [];

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
        sorted,
        90
      );

      if (isTrendTemplateError(trendTemplateResult)) {
        trendTemplateErrors.push(trendTemplateResult);
      } else if (passesTrendTemplateCriteria(trendTemplateResult)) {
        if (symbolData.isEtf) {
          longTermEtfResults.push(trendTemplateResult);
        } else {
          longTermStockResults.push(trendTemplateResult);
        }
      }
    }

    // Sort the results arrays in descending order based on compositeRelativeStrength
    const sortedStocks = [...longTermStockResults].sort(
      (a, b) => b.compositeRelativeStrength - a.compositeRelativeStrength
    );

    const sortedEtfs = [...longTermEtfResults].sort(
      (a, b) => b.compositeRelativeStrength - a.compositeRelativeStrength
    );

    const trendTemplateResults: TrendTemplateResults = {
      lastDate: this.cacheSvc.getLastDate()!,
      stocks: sortedStocks,
      etfs: sortedEtfs,
    };

    return trendTemplateResults;
  }

  private buildShortTermTrendTemplateResults(): TrendTemplateResults {
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();

    const trendTemplateErrors: TrendTemplateError[] = [];
    const shortTermStockResults: TrendTemplateResult[] = [];
    const shortTermEtfResults: TrendTemplateResult[] = [];

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
        sorted,
        20
      );

      if (isTrendTemplateError(trendTemplateResult)) {
        trendTemplateErrors.push(trendTemplateResult);
      } else if (passesShortTermTrendTemplateCriteria(trendTemplateResult)) {
        if (symbolData.isEtf) {
          shortTermEtfResults.push(trendTemplateResult);
        } else {
          shortTermStockResults.push(trendTemplateResult);
        }
      }
    }

    // Sort the results arrays in descending order based on compositeRelativeStrength
    const sortedStocks = [...shortTermStockResults].sort(
      (a, b) => b.compositeRelativeStrength - a.compositeRelativeStrength
    );

    const sortedEtfs = [...shortTermEtfResults].sort(
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
    candles: Candle[],
    period: number
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

    const last = twoHundredSMASeq.slice(-period);
    const linearReg = calculateLinearRegressionFromNumbers(last, period);

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

    const benchMarkCandles = this.cacheSvc.getCandles("SPY");
    const filteredBenchmarkCandles = filterCandlesPast52Weeks(benchMarkCandles);
    const rsLine = getRelativeStrengthLine(filteredBenchmarkCandles, filtered);

    if (!rsLine) {
      const err: TrendTemplateError = {
        symbol: ticker,
        error: "error calculating rs line",
      };

      return err;
    }

    const values = rsLine.data.map((p) => p.value);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const lastValue = values[values.length - 1];

    const fiftyTwoWeekRSLinePercent =
      maxVal === minVal ? 0 : ((lastValue - minVal) / (maxVal - minVal)) * 100;

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
      relativeStrengthPercentOfFiftyTwoWeekRange: fiftyTwoWeekRSLinePercent,
    };

    return result;
  }

  public emaJumpers(
    relativeVolumeThreshold: number,
    minClosePrice: number = 5
  ) {
    console.log("Calculating Ema Jumpers Screen");
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();

    const filteredResults: ScreenerResult[] = [];

    for (const symbolData of [...stocks, ...etfs]) {
      const symbol = symbolData.Symbol;
      const candles = this.cacheSvc.getCandles(symbol);

      if (!candles || candles.length === 0) {
        continue;
      }

      const fiftyTwoWeekCandles = filterCandlesPast52Weeks(candles);

      const weekCandles = filterCandlesPastWeeks(fiftyTwoWeekCandles, 1);
      if (!weekCandles || weekCandles.length == 0) {
        console.log("Unable to generate a week candle");
        continue;
      }

      if (
        fiftyTwoWeekCandles[fiftyTwoWeekCandles.length - 1].close <
          minClosePrice ||
        fiftyTwoWeekCandles.length < 50
      ) {
        console.error(`Missing data for ${symbolData.Symbol}`);
        continue;
      }

      const [head, tail] = fiftyTwoWeekCandles.slice(-2);

      const allButLast = fiftyTwoWeekCandles.slice(0, -1);
      const closes = allButLast.map((c) => c.close);
      const tenEMA = ema(10, closes);
      const twentyOneEMA = ema(21, closes);
      const fiftySMA = sma(50, closes);

      const lastTwenty = fiftyTwoWeekCandles.slice(-20);
      const lastTwentyVolumes = lastTwenty.map((c) => c.volume);
      const avgVol20D = sma(20, lastTwentyVolumes);

      if (
        isMovingAverageError(tenEMA) ||
        isMovingAverageError(twentyOneEMA) ||
        isMovingAverageError(fiftySMA) ||
        isMovingAverageError(avgVol20D)
      ) {
        console.log(`Unable to calculate moving averages for ${symbol}`);
        continue;
      }

      const relativeVolume: number = tail.volume / avgVol20D;

      const rsStats =
        this.relativeStrengthSvc.getRelativeStrengthStatsForSymbol(symbol);

      const threeMonthRS = this.relativeStrengthSvc.getRelativeStrength(
        symbol,
        "3M"
      );

      if (isRelativeStrengthError(rsStats)) {
        console.error(
          `Unable to calculate relative strength stats for ${symbol}`
        );
        continue;
      }

      if (
        head.low < tenEMA &&
        head.low < twentyOneEMA &&
        tail.close >= tenEMA &&
        tail.close >= twentyOneEMA &&
        tail.close > fiftySMA &&
        relativeVolume > relativeVolumeThreshold
      ) {
        const returns = (tail.close - head.close) / head.close;
        const dailyIBS = internalBarStrength(tail);

        const fiftyTwoWeekHighs = fiftyTwoWeekCandles.map((c) => c.high);
        const fiftyTwoWeekLows = fiftyTwoWeekCandles.map((c) => c.low);
        const fiftyTwoWeekHigh = Math.max(...fiftyTwoWeekHighs);
        const fiftyTwoWeekLow = Math.min(...fiftyTwoWeekLows);
        const percentOf52WeekHigh =
          ((tail.close - fiftyTwoWeekLow) /
            (fiftyTwoWeekHigh - fiftyTwoWeekLow)) *
          100;

        const weekIBS = this.calculateWeekCandleIBS(weekCandles);

        const result: ScreenerResult = {
          symbol: symbolData.Symbol,
          name: symbolData.companyName,
          isEtf: symbolData.isEtf,
          last: tail.close,
          lastReturnPercent: Number((returns * 100).toFixed(2)),
          volume: tail.volume,
          avgVolume20D: Number(avgVol20D.toFixed(2)),
          relativeVolume20D: Number(relativeVolume.toFixed(2)),
          dailyIBS: Number(dailyIBS.toFixed(2)),
          weeklyIBS: Number(weekIBS.toFixed(2)),
          percentOf52WeekHigh: Number(percentOf52WeekHigh.toFixed(2)),
          rsRating: rsStats.compositeScore,
          threeMonthRS: threeMonthRS ? threeMonthRS.relativeStrength : 0,
          fiftyTwoWeekRSLinePercent: Number(
            rsStats.relativeStrengthLineStats.percentOfFiftyTwoWeekRange.toFixed(
              2
            )
          ),
        };

        filteredResults.push(result);
      }
    }

    return filteredResults;
  }

  public gapUpOnVolume(
    gapPercent: number,
    minAvgVolume: number,
    relativeVolumeThreshold: number,
    minClosePrice: number = 5
  ): GapUpOnVolumeScreenerResult[] {
    console.log("Calculating Gap Up on Volume Screen");
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();

    const unfilteredResults: GapUpOnVolumeScreenerResult[] = [];

    for (const symbolData of [...stocks, ...etfs]) {
      const symbol = symbolData.Symbol;
      const candles = this.cacheSvc.getCandles(symbol);

      if (!candles || candles.length === 0) {
        continue;
      }

      const fiftyTwoWeekCandles = filterCandlesPast52Weeks(candles);

      if (
        fiftyTwoWeekCandles[fiftyTwoWeekCandles.length - 1].close <
          minClosePrice ||
        fiftyTwoWeekCandles.length < 20 ||
        fiftyTwoWeekCandles.length < 240
      ) {
        console.error(`Missing data for ${symbolData.Symbol}`);
        continue;
      }

      const [head, tail] = fiftyTwoWeekCandles.slice(-2);
      const gapUpPercent = ((tail.open - head.close) / head.close) * 100;

      const returns = (tail.close - head.close) / head.close;

      const lastTwenty = fiftyTwoWeekCandles.slice(-20);
      const lastTwentyVolumes = lastTwenty.map((c) => c.volume);
      const avgVol20D = sma(20, lastTwentyVolumes);

      const fiftyTwoWeekHighs = fiftyTwoWeekCandles.map((c) => c.high);
      const fiftyTwoWeekLows = fiftyTwoWeekCandles.map((c) => c.low);
      const fiftyTwoWeekHigh = Math.max(...fiftyTwoWeekHighs);
      const fiftyTwoWeekLow = Math.min(...fiftyTwoWeekLows);
      const percentOf52WeekHigh =
        ((tail.close - fiftyTwoWeekLow) /
          (fiftyTwoWeekHigh - fiftyTwoWeekLow)) *
        100;

      if (isMovingAverageError(avgVol20D)) {
        console.error(
          `Unable to calculate avg volume for ${symbolData.Symbol}`
        );
        continue;
      }

      const relativeVolume: number = tail.volume / avgVol20D;

      const rsStats =
        this.relativeStrengthSvc.getRelativeStrengthStatsForSymbol(symbol);

      if (isRelativeStrengthError(rsStats)) {
        console.log(
          `Unable to calculate relative strength stats for ${symbol}`
        );
        continue;
      }

      const dailyIBS = internalBarStrength(tail);

      const weekCandles = filterCandlesPastWeeks(fiftyTwoWeekCandles, 1);

      if (!weekCandles || weekCandles.length == 0) {
        console.log("Unable to generate a week candle");
        continue;
      }

      const weekIBS = this.calculateWeekCandleIBS(weekCandles);

      const threeMonthRS = this.relativeStrengthSvc.getRelativeStrength(
        symbol,
        "3M"
      );

      const screenerResult: ScreenerResult = {
        symbol: symbol,
        isEtf: symbolData.isEtf,
        name: symbolData.companyName,
        industry: symbolData.industry,
        last: tail.close,
        lastReturnPercent: Number((returns * 100).toFixed(2)),
        volume: tail.volume,
        avgVolume20D: avgVol20D,
        relativeVolume20D: Number(relativeVolume.toFixed(2)),
        dailyIBS: Number(dailyIBS.toFixed(2)),
        weeklyIBS: Number(weekIBS.toFixed(2)),
        percentOf52WeekHigh: percentOf52WeekHigh,
        threeMonthRS: threeMonthRS ? threeMonthRS.relativeStrength : 0,
        rsRating: rsStats.compositeScore,
        fiftyTwoWeekRSLinePercent: Number(
          rsStats.relativeStrengthLineStats.percentOfFiftyTwoWeekRange.toFixed(
            2
          )
        ),
      };

      const gapUpResult: GapUpOnVolumeScreenerResult = {
        ...screenerResult,
        gapUpPercent: gapUpPercent,
      };

      unfilteredResults.push(gapUpResult);
    }

    const filtered = unfilteredResults.filter(
      (res) =>
        res.gapUpPercent >= gapPercent &&
        res.relativeVolume20D > relativeVolumeThreshold &&
        res.avgVolume20D > minAvgVolume &&
        res.last > minClosePrice
    );

    console.log("Finished Calculating Gap Up on Volume Screen");

    return filtered;
  }

  private calculateWeekCandleIBS(weekCandles: Candle[]): number {
    const highs = weekCandles.map((c) => c.high);
    const lows = weekCandles.map((c) => c.low);

    const weekHigh = Math.max(...highs);
    const weekLow = Math.min(...lows);
    const weekVolume = weekCandles
      .map((c) => c.volume)
      .reduce((acc, current) => acc + current, 0);

    const weekCandle: Candle = {
      date: weekCandles[0].date,
      dateStr: weekCandles[0].dateStr,
      open: weekCandles[0].open,
      high: weekHigh,
      low: weekLow,
      close: weekCandles[weekCandles.length - 1].close,
      volume: weekVolume,
    };

    const weekIBS = internalBarStrength(weekCandle);

    return weekIBS;
  }
}
