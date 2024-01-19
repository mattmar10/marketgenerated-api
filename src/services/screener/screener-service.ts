import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { DailyCacheService } from "../daily_cache_service";

import {
  Either,
  Left,
  Right,
  Ticker,
  isLeft,
  match,
} from "../../MarketGeneratedTypes";
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

import { isRelativeStrengthError } from "../relative-strength/relative-strength-types";
import {
  GapUpOnVolumeScreenerResult,
  ScreenerResult,
  TrendTemplateResult,
  TrendTemplateResults,
} from "./screener-types";
import { FundamentalRelativeStrengthService } from "../fundamental-relative-strength/funamental-relative-strength-service";
import { FMPSymbolProfileData } from "../financial_modeling_prep_types";

export interface TrendTemplateError {
  symbol: Ticker;
  error: string;
}

function passesTrendTemplateCriteria(ttr: TrendTemplateResult): boolean {
  const lowThreshold = ttr.fiftyTwoWeekLow + 0.3 * ttr.fiftyTwoWeekLow;
  const highThreshold = ttr.fiftyTwoWeekHigh - 0.25 * ttr.fiftyTwoWeekHigh;

  return (
    //ttr.lastClose > ttr.fiftyMA &&
    ttr.fiftySMA > ttr.oneFiftySMA &&
    ttr.oneFiftySMA > ttr.twoHundredSMA &&
    ttr.twoHudredMALRSlope > 0 &&
    ttr.last > lowThreshold &&
    ttr.last > highThreshold &&
    ttr.relativeStrengthCompositeScore > 75
  );
}

function passesShortTermTrendTemplateCriteria(
  ttr: TrendTemplateResult
): boolean {
  const lowThreshold = ttr.fiftyTwoWeekLow + 0.3 * ttr.fiftyTwoWeekLow;
  const highThreshold = ttr.fiftyTwoWeekHigh - 0.25 * ttr.fiftyTwoWeekHigh;

  return (
    ttr.last > ttr.fiftySMA &&
    ttr.fiftySMA > ttr.oneFiftySMA &&
    ttr.oneFiftySMA > ttr.twoHundredSMA &&
    ttr.twoHudredMALRSlope > 0 &&
    ttr.last > lowThreshold &&
    ttr.last > highThreshold &&
    ttr.relativeStrengthCompositeScore > 75
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
    private relativeStrengthSvc: RelativeStrengthService,
    @inject(TYPES.FundamentalRelativeStrengthService)
    private fundamentalRelativeStrengthService: FundamentalRelativeStrengthService
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

      const trendTemplateResult = this.buildTrendTemplateResult(
        symbolData,
        sorted,
        90
      );

      match(
        trendTemplateResult,
        (error) => {
          trendTemplateErrors.push(error);
        },
        (data) => {
          if (passesTrendTemplateCriteria(data)) {
            if (symbolData.isEtf) {
              longTermEtfResults.push(data);
            } else {
              longTermStockResults.push(data);
            }
          }
        }
      );
    }

    // Sort the results arrays in descending order based on compositeRelativeStrength
    const sortedStocks = [...longTermStockResults].sort(
      (a, b) =>
        b.relativeStrengthCompositeScore - a.relativeStrengthCompositeScore
    );

    const sortedEtfs = [...longTermEtfResults].sort(
      (a, b) =>
        b.relativeStrengthCompositeScore - a.relativeStrengthCompositeScore
    );

    const trendTemplateResults: TrendTemplateResults = {
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

      const trendTemplateResult = this.buildTrendTemplateResult(
        symbolData,
        sorted,
        60
      );

      match(
        trendTemplateResult,
        (error) => {
          trendTemplateErrors.push(error);
        },
        (data) => {
          if (passesShortTermTrendTemplateCriteria(data)) {
            if (symbolData.isEtf) {
              shortTermEtfResults.push(data);
            } else {
              shortTermStockResults.push(data);
            }
          }
        }
      );
    }

    // Sort the results arrays in descending order based on compositeRelativeStrength
    const sortedStocks = [...shortTermStockResults].sort(
      (a, b) =>
        b.relativeStrengthCompositeScore - a.relativeStrengthCompositeScore
    );

    const sortedEtfs = [...shortTermEtfResults].sort(
      (a, b) =>
        b.relativeStrengthCompositeScore - a.relativeStrengthCompositeScore
    );

    const trendTemplateResults: TrendTemplateResults = {
      stocks: sortedStocks,
      etfs: sortedEtfs,
    };

    return trendTemplateResults;
  }

  private buildTrendTemplateResult(
    symbolData: FMPSymbolProfileData,
    candles: Candle[],
    period: number
  ): Either<TrendTemplateError, TrendTemplateResult> {
    const filtered = filterCandlesPast52Weeks(candles);

    if (!filtered || filtered.length <= 200) {
      const err: TrendTemplateError = {
        symbol: symbolData.Symbol,
        error: "Not enough candles to calculate trend template",
      };

      return Left(err);
    }

    const closes = filtered.map((c) => c.close);

    const twoHundredSMA = sma(200, closes);
    const oneFiftySMA = sma(150, closes);

    const allSorted = sortCandlesByDate(candles).map((c) => c.close);
    const twoHundredSMASeq = smaSeq(200, allSorted);

    if (
      isMovingAverageError(twoHundredSMASeq) ||
      isMovingAverageError(twoHundredSMA) ||
      isMovingAverageError(oneFiftySMA)
    ) {
      const err: TrendTemplateError = {
        symbol: symbolData.Symbol,
        error: "Not enough candles to calculate 200 MA",
      };

      return Left(err);
    }

    const last = twoHundredSMASeq.slice(-period);
    const linearReg = calculateLinearRegressionFromNumbers(last, period);

    if (!isLinearRegressionResult(linearReg)) {
      const err: TrendTemplateError = {
        symbol: symbolData.Symbol,
        error: "Error calculating linear regression of 200MA",
      };

      return Left(err);
    }

    const screenerResultEither = this.buildScreenerResult(symbolData, 10);

    if (isLeft(screenerResultEither)) {
      const err: TrendTemplateError = {
        symbol: symbolData.Symbol,
        error: screenerResultEither.value,
      };
      return Left(err);
    } else {
      const ttResult: TrendTemplateResult = {
        ...screenerResultEither.value,
        oneFiftySMA: oneFiftySMA,
        twoHundredSMA: twoHundredSMA,
        twoHudredMALRSlope: linearReg.slope,
        resultDateTime: new Date().toLocaleString(),
      };

      return Right(ttResult);
    }
  }

  public emaCrossWithVolume(
    emaPeriod: number = 20,
    relativeVolumeThreshold: number = 1.5,
    minClosePrice: number = 5
  ): ScreenerResult[] {
    console.log("Calculating Ema Cross Screen");
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

      const closes = fiftyTwoWeekCandles.map((c) => c.close);

      const calculatedEMA = ema(emaPeriod, closes);
      const fiftySMA = sma(50, closes);

      const lastTwenty = fiftyTwoWeekCandles.slice(-20);
      const lastTwentyVolumes = lastTwenty.map((c) => c.volume);
      const avgVol20D = sma(20, lastTwentyVolumes);

      if (
        isMovingAverageError(calculatedEMA) ||
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
        continue;
      }

      if (
        head.low < calculatedEMA &&
        tail.close >= calculatedEMA &&
        calculatedEMA > fiftySMA &&
        tail.close > fiftySMA &&
        relativeVolume > relativeVolumeThreshold
      ) {
        const result = this.buildScreenerResult(symbolData, minClosePrice);

        match(
          result,
          (errorString) => console.error(errorString),
          (data) => filteredResults.push(data)
        );
      }
    }

    return filteredResults;
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
        continue;
      }

      const [head, tail] = fiftyTwoWeekCandles.slice(-2);

      const allButLast = fiftyTwoWeekCandles.slice(0, -1);
      const closes = fiftyTwoWeekCandles.map((c) => c.close);
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
        const result = this.buildScreenerResult(symbolData, minClosePrice);

        match(
          result,
          (errorString) => console.error(errorString),
          (data) => filteredResults.push(data)
        );
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
        continue;
      }

      const [head, tail] = fiftyTwoWeekCandles.slice(-2);
      const gapUpPercent = ((tail.open - head.close) / head.close) * 100;

      const result = this.buildScreenerResult(symbolData, minClosePrice);

      match(
        result,
        (errorString) => console.error(errorString),
        (screenerResult) => {
          const gapUpResult: GapUpOnVolumeScreenerResult = {
            ...screenerResult,
            gapUpPercent: gapUpPercent,
          };

          unfilteredResults.push(gapUpResult);
        }
      );
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

  areNumbersWithinPercentage = (
    num1: number,
    num2: number,
    percentage: number
  ): boolean => {
    const average = (num1 + num2) / 2;
    const allowedDifference = (percentage / 100) * average;
    const absoluteDifference = Math.abs(num1 - num2);

    return absoluteDifference <= allowedDifference;
  };

  public institutionalSupport(minClosePrice: number = 10) {
    console.log("Calculating Institutional Support screen");

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
        continue;
      }
      const closes = fiftyTwoWeekCandles.map((c) => c.close);

      const volumes = fiftyTwoWeekCandles.map((c) => c.volume);
      const dailyIBS = internalBarStrength(
        fiftyTwoWeekCandles[fiftyTwoWeekCandles.length - 1]
      );

      const lastVol = volumes[volumes.length - 1];
      const lastClose = closes[closes.length - 1];

      const fiftySMASeq = smaSeq(50, closes);
      const twoHundredSMASeq = smaSeq(200, closes);

      const lastTwenty = fiftyTwoWeekCandles.slice(-20);
      const lastTwentyVolumes = lastTwenty.map((c) => c.volume);
      const avgVol20D = sma(20, lastTwentyVolumes);

      if (
        isMovingAverageError(fiftySMASeq) ||
        isMovingAverageError(twoHundredSMASeq)
      ) {
        continue;
      }

      const linearReg = calculateLinearRegressionFromNumbers(fiftySMASeq, 20);
      const linearReg2 = calculateLinearRegressionFromNumbers(
        twoHundredSMASeq,
        40
      );

      if (
        isMovingAverageError(fiftySMASeq) ||
        isMovingAverageError(avgVol20D) ||
        !isLinearRegressionResult(linearReg) ||
        !isLinearRegressionResult(linearReg2)
      ) {
        continue;
      }

      if (
        this.areNumbersWithinPercentage(
          lastClose,
          fiftySMASeq[fiftySMASeq.length - 1],
          7
        ) &&
        dailyIBS > 0.8 &&
        linearReg.slope > 0 &&
        linearReg2.slope > 0 &&
        lastVol > avgVol20D
      ) {
        const result = this.buildScreenerResult(symbolData, minClosePrice);

        match(
          result,
          (errorString) => console.error(errorString),
          (data) => filteredResults.push(data)
        );
      }
    }

    return filteredResults;
  }

  public launchPad(minClosePrice: number = 5) {
    console.log("Calculating Launchpad screen");
    const areWithinThreePercent = (
      a: number,
      b: number,
      c: number
    ): boolean => {
      const diffAB = Math.abs((a - b) / a) * 100;
      const diffAC = Math.abs((a - c) / a) * 100;
      const diffBC = Math.abs((b - c) / b) * 100;
      return diffAB <= 3 && diffAC <= 3 && diffBC <= 3;
    };

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
        continue;
      }

      const allButLast = fiftyTwoWeekCandles.slice(0, -1);
      const closes = allButLast.map((c) => c.close);

      const tenEMA = ema(10, closes);
      const twentyEMA = ema(20, closes);
      const fiftySMA = sma(50, closes);

      const lastTwenty = fiftyTwoWeekCandles.slice(-20);
      const lastTwentyVolumes = lastTwenty.map((c) => c.volume);
      const avgVol20D = sma(20, lastTwentyVolumes);

      if (
        isMovingAverageError(tenEMA) ||
        isMovingAverageError(twentyEMA) ||
        isMovingAverageError(fiftySMA) ||
        isMovingAverageError(avgVol20D)
      ) {
        continue;
      }

      if (areWithinThreePercent(tenEMA, twentyEMA, fiftySMA)) {
        const result = this.buildScreenerResult(symbolData, minClosePrice);

        match(
          result,
          (errorString) => console.error(errorString),
          (data) => filteredResults.push(data)
        );
      }
    }

    return filteredResults;
  }

  public mgScoreLeaders(
    minClosePrice: number,
    count: number = 100
  ): ScreenerResult[] {
    console.log("Calculating MG Score screen");
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();

    type MGScore = {
      symbolData: FMPSymbolProfileData;
      mgScore: number;
    };

    const mgScores: MGScore[] = [];

    for (const symbolData of [...stocks, ...etfs]) {
      const symbol = symbolData.Symbol;
      const fundamentalScore =
        this.fundamentalRelativeStrengthService.getFundamentalRankAndScoreForSymbol(
          symbol
        );

      const candles = this.cacheSvc.getCandles(symbol);

      if (!candles || candles.length === 0) {
        continue;
      }

      const fiftyTwoWeekCandles = filterCandlesPast52Weeks(candles);
      const closes = fiftyTwoWeekCandles.map((c) => c.close);
      const twoHundredSMA = sma(200, closes);

      if (isMovingAverageError(twoHundredSMA)) {
        continue;
      }

      if (closes[closes.length - 1] < twoHundredSMA) {
        continue;
      }
      const rs =
        this.relativeStrengthSvc.getRelativeStrengthStatsForSymbol(symbol);

      if (fundamentalScore && !isRelativeStrengthError(rs)) {
        const fundScore = fundamentalScore.rank;

        const compositeRSScore = rs.compositeScore;

        const rsLinePercent =
          rs.relativeStrengthLineStats.percentOfFiftyTwoWeekRange;

        const mgScore =
          0.65 * (compositeRSScore * 0.4 + 0.6 * rsLinePercent) +
          0.35 * fundScore;

        mgScores.push({
          symbolData: symbolData,
          mgScore: mgScore,
        });
      }

      mgScores.sort((a, b) => b.mgScore - a.mgScore);
    }

    const filteredResults: ScreenerResult[] = [];

    for (const mgScore of mgScores) {
      const result = this.buildScreenerResult(
        mgScore.symbolData,
        minClosePrice
      );

      match(
        result,
        (errorString) => console.error(errorString),
        (data) => filteredResults.push(data)
      );

      if (filteredResults.length === count) {
        break;
      }
    }

    return filteredResults;
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

  private buildScreenerResult(
    symbolData: FMPSymbolProfileData,
    minimumClosePrice: number
  ): Either<string, ScreenerResult> {
    const symbol = symbolData.Symbol;
    const candles = this.cacheSvc.getCandles(symbol);

    if (!candles || candles.length === 0) {
      return Left("Missing data");
    }

    const fiftyTwoWeekCandles = filterCandlesPast52Weeks(candles);

    const weekCandles = filterCandlesPastWeeks(fiftyTwoWeekCandles, 1);
    if (!weekCandles || weekCandles.length == 0) {
      console.log("Unable to generate a week candle");
      return Left("Unable to generate a week candle");
    }

    if (
      fiftyTwoWeekCandles[fiftyTwoWeekCandles.length - 1].close <
      minimumClosePrice
    ) {
      return Left(
        `Close price of ${
          fiftyTwoWeekCandles[fiftyTwoWeekCandles.length - 1].close
        } is below minimum of ${minimumClosePrice}`
      );
    }

    if (fiftyTwoWeekCandles.length < 50) {
      return Left("Not enough candles");
    }

    const [head, tail] = fiftyTwoWeekCandles.slice(-2);

    const returns = (tail.close - head.close) / head.close;
    const dailyIBS = internalBarStrength(tail);

    const fiftyTwoWeekHighs = fiftyTwoWeekCandles.map((c) => c.high);
    const fiftyTwoWeekLows = fiftyTwoWeekCandles.map((c) => c.low);
    const fiftyTwoWeekHigh = Math.max(...fiftyTwoWeekHighs);
    const fiftyTwoWeekLow = Math.min(...fiftyTwoWeekLows);
    const percentOf52WeekHigh =
      ((tail.close - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) *
      100;

    const weekIBS = this.calculateWeekCandleIBS(weekCandles);

    const closes = fiftyTwoWeekCandles.map((c) => c.close);
    const tenEMA = ema(10, closes);
    const twentyEMA = ema(20, closes);
    const fiftySMA = sma(50, closes);

    const lastTwenty = fiftyTwoWeekCandles.slice(-20);
    const lastTwentyVolumes = lastTwenty.map((c) => c.volume);
    const avgVol20D = sma(20, lastTwentyVolumes);

    if (
      isMovingAverageError(tenEMA) ||
      isMovingAverageError(twentyEMA) ||
      isMovingAverageError(fiftySMA) ||
      isMovingAverageError(avgVol20D)
    ) {
      return Left(`Unable to calculate moving averages for ${symbol}`);
    }

    const relativeVolume: number = tail.volume / avgVol20D;

    const threeMonthRS = this.relativeStrengthSvc.getRelativeStrength(
      symbol,
      "3M"
    );

    const fundamentalRankAndScore =
      this.fundamentalRelativeStrengthService.getFundamentalRankAndScoreForSymbol(
        symbol
      );

    const fundamentalScore = fundamentalRankAndScore
      ? fundamentalRankAndScore.rank
      : 0;

    const compositeRSScore =
      this.relativeStrengthSvc.getCompositeRelativeStrengthForSymbol(symbol);

    const rsStats =
      this.relativeStrengthSvc.getRelativeStrengthStatsForSymbol(symbol);

    if (isRelativeStrengthError(rsStats)) {
      return Left(`Unable to calculate relative strength stats for ${symbol}`);
    }
    const rsLinePercent =
      rsStats.relativeStrengthLineStats.percentOfFiftyTwoWeekRange;

    const mgScore =
      0.6 * (compositeRSScore * 0.4 + 0.6 * rsLinePercent) +
      0.4 * fundamentalScore;

    const result: ScreenerResult = {
      symbol: symbolData.Symbol,
      name: symbolData.companyName,
      isEtf: symbolData.isEtf,
      last: tail.close,
      fiftyTwoWeekHigh: fiftyTwoWeekHigh,
      fiftyTwoWeekLow: fiftyTwoWeekLow,
      lastReturnPercent: Number((returns * 100).toFixed(2)),
      volume: tail.volume,
      avgVolume20D: Number(avgVol20D.toFixed(2)),
      relativeVolume20D: Number(relativeVolume.toFixed(2)),
      dailyIBS: Number(dailyIBS.toFixed(2)),
      weeklyIBS: Number(weekIBS.toFixed(2)),
      percentOf52WeekHigh: Number(percentOf52WeekHigh.toFixed(2)),
      threeMonthRS: threeMonthRS ? threeMonthRS.relativeStrength : 0,
      fiftyTwoWeekRSLinePercent: Number(
        rsStats.relativeStrengthLineStats.percentOfFiftyTwoWeekRange.toFixed(2)
      ),
      industry: !symbolData.isEtf ? symbolData.industry : "",
      sector: !symbolData.isEtf ? symbolData.sector : "",
      relativeStrengthCompositeScore: Number(compositeRSScore.toFixed(2)),
      fundamentalRelativeStrengthScore: Number(fundamentalScore.toFixed(2)),
      mgScore: Number(mgScore.toFixed(2)),
      fiftySMA: Number(fiftySMA.toFixed(2)),
      twentyEMA: Number(twentyEMA.toFixed(2)),
      tenEMA: Number(tenEMA.toFixed(2)),
      lastDate: tail.dateStr!,
      resultDateTime: new Date().toLocaleString(),
    };

    return Right(result);
  }
}
