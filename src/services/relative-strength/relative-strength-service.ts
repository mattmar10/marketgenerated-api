import { inject, injectable } from "inversify";
import { DailyCacheService } from "../daily_cache_service";
import TYPES from "../../types";
import {
  Either,
  Left,
  Right,
  Ticker,
  isLeft,
  isRight,
} from "../../MarketGeneratedTypes";
import { SymbolService } from "../symbol/symbol_service";
import {
  calculatePercentageReturn,
  filterCandlesMapToPastMonths,
  filterCandlesPast52Weeks,
  filterCandlesPastMonths,
  filterCandlesPastWeeks,
  filterCandlesYearToDate,
  isIndicatorError,
} from "../../indicators/indicator-utils";
import { Candle } from "../../modles/candle";
import {
  RelativeStrength,
  RelativeStrengthError,
  RelativeStrengthLineStats,
  RelativeStrengthPerformers,
  RelativeStrengthPerformersForPeriod,
  RelativeStrengthPoint,
  RelativeStrengthTimePeriod,
  RelativeStrengthTimePeriodTypes,
  RelativeStrengthsForSymbol,
  RelativeStrengthsForSymbolStats,
  RelativeStrengthsFromSlopeAggregate,
  ReturnData,
  isRelativeStrengthsForSymbol,
} from "./relative-strength-types";
import { getRelativeStrengthLine } from "../../indicators/relative-strength";
import {
  calculateLinearRegression,
  calculateLinearRegressionFromNumbers,
  isLinearRegressionResult,
} from "../../indicators/linear-regression";
import {
  ema,
  isMovingAverageError,
  sma,
} from "../../indicators/moving-average";
import { DataError } from "../data_error";
import { sortMapByValue } from "../../utils/basic_utils";
import { getDateNMonthsAgo } from "../../utils/epoch_utils";
import { int } from "aws-sdk/clients/datapipeline";

@injectable()
export class RelativeStrengthService {
  private stockReturns: ReturnData[];
  private etfReturns: ReturnData[];

  private stockRelativeStrengthsMap: Map<
    RelativeStrengthTimePeriod,
    RelativeStrength[]
  > = new Map();

  private etfRelativeStrengthsMap: Map<
    RelativeStrengthTimePeriod,
    RelativeStrength[]
  > = new Map();

  private etfRelativeStrengthsFromSlopeMap: Map<
    Ticker,
    RelativeStrengthsFromSlopeAggregate
  > = new Map();

  private stockRelativeStrengthsFromSlopeMap: Map<
    Ticker,
    RelativeStrengthsFromSlopeAggregate
  > = new Map();

  private stocksRSForSymbols: RelativeStrengthsForSymbol[] = [];
  private etfsRSForSymbols: RelativeStrengthsForSymbol[] = [];

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService
  ) {}

  private buildReturnData(
    symbol: Ticker,
    name: string,
    candles: Candle[]
  ): ReturnData | undefined {
    const filtered = filterCandlesPast52Weeks(candles);
    const yearToDate = filterCandlesYearToDate(candles);
    const sixMonthsAgo = filterCandlesPastMonths(filtered, 6);
    const threeMonthsAgo = filterCandlesPastMonths(filtered, 3);
    const oneMonthsAgo = filterCandlesPastMonths(filtered, 1);
    const oneWeekAgo = filterCandlesPastWeeks(filtered, 1);
    const oneDayAgo = filtered.slice(-2);

    if (!filtered || filtered.length < 240) {
      return undefined;
    }

    const oneYearReturns = calculatePercentageReturn(filtered);
    const yearToDateReturns = calculatePercentageReturn(yearToDate);
    const sixMonthReturns = calculatePercentageReturn(sixMonthsAgo);
    const threeMonthReturns = calculatePercentageReturn(threeMonthsAgo);
    const oneMonthReturns = calculatePercentageReturn(oneMonthsAgo);
    const oneWeekReturns = calculatePercentageReturn(oneWeekAgo);
    const oneDayReturns = calculatePercentageReturn(oneDayAgo);

    if (
      isIndicatorError(oneYearReturns) ||
      isIndicatorError(yearToDateReturns) ||
      isIndicatorError(sixMonthReturns) ||
      isIndicatorError(threeMonthReturns) ||
      isIndicatorError(oneMonthReturns) ||
      isIndicatorError(oneWeekReturns) ||
      isIndicatorError(oneDayReturns)
    ) {
      console.error(
        `Error calculating returns for ${symbol}. ${oneYearReturns}`
      );

      const returnData: ReturnData = {
        symbol: symbol,
        name: name,
        oneYearReturns: isIndicatorError(oneYearReturns) ? 0 : oneYearReturns,
        yearToDateReturns: isIndicatorError(yearToDateReturns)
          ? 0
          : yearToDateReturns,

        sixMonthReturns: isIndicatorError(sixMonthReturns)
          ? 0
          : sixMonthReturns,

        threeMonthReturns: isIndicatorError(threeMonthReturns)
          ? 0
          : threeMonthReturns,
        oneMonthReturns: isIndicatorError(oneMonthReturns)
          ? 0
          : oneMonthReturns,

        oneWeekReturns: isIndicatorError(oneWeekReturns) ? 0 : oneWeekReturns,
        oneDayReturns: isIndicatorError(oneDayReturns) ? 0 : oneDayReturns,
      };

      return returnData;
    } else {
      const returnData: ReturnData = {
        symbol: symbol,
        name: name,
        oneYearReturns: oneYearReturns,
        yearToDateReturns: yearToDateReturns,
        sixMonthReturns: sixMonthReturns,
        threeMonthReturns: threeMonthReturns,
        oneMonthReturns: oneMonthReturns,
        oneWeekReturns: oneWeekReturns,
        oneDayReturns: oneDayReturns,
      };

      return returnData;
    }
  }

  public initializeRelativeStrengthsBySlopeData() {
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();

    const universeOfStockKeys = stocks.map((s) => s.Symbol);
    const universeOfEtfKeys = etfs.map((e) => e.Symbol);

    type RelativeStrengthsFromSlope = {
      stocks: Map<Ticker, number>;
      etfs: Map<Ticker, number>;
    };

    const calculateRSFromSlopeForMonthsBack = (monthsBack: int) => {
      const startDate = getDateNMonthsAgo(monthsBack);
      const filterFn = (candle: Candle) => candle.date >= startDate.getTime();

      const stockCandles: Map<Ticker, Candle[]> = new Map();
      const etfCandles: Map<Ticker, Candle[]> = new Map();

      universeOfStockKeys.forEach((e) => {
        const candles = this.cacheSvc.getCandlesWithFilter(e, filterFn);

        if (candles && candles.length > 0) {
          stockCandles.set(e, candles);
        }
      });
      universeOfEtfKeys.forEach((e) => {
        const candles = this.cacheSvc.getCandlesWithFilter(e, filterFn);
        if (candles && candles.length > 0) {
          etfCandles.set(e, candles);
        }
      });

      const benchMarkCandles = this.cacheSvc.getCandlesWithFilter(
        "SPY",
        filterFn
      );
      const etfRelativeStrengths = this.calculateRelativeStrengthsByLineSlope(
        etfCandles,
        benchMarkCandles
      );
      const stockRelativeStrengths = this.calculateRelativeStrengthsByLineSlope(
        stockCandles,
        benchMarkCandles
      );

      if (isLeft(etfRelativeStrengths) || isLeft(stockRelativeStrengths)) {
        console.error(
          `Unable to calculate relative strengths for ${monthsBack} months`
        );
      } else {
        const result: RelativeStrengthsFromSlope = {
          stocks: stockRelativeStrengths.value,
          etfs: etfRelativeStrengths.value,
        };

        return result;
      }
    };

    console.log("Building RS Data from slopes");

    const etfRelativeStrengthsFromSlopeMap: Map<
      RelativeStrengthTimePeriod,
      Map<Ticker, number>
    > = new Map();

    const stockRelativeStrengthsFromSlopeMap: Map<
      RelativeStrengthTimePeriod,
      Map<Ticker, number>
    > = new Map();

    const oneMonth = calculateRSFromSlopeForMonthsBack(1);
    const threeMonth = calculateRSFromSlopeForMonthsBack(3);
    const sixMonth = calculateRSFromSlopeForMonthsBack(6);
    const twelveMonth = calculateRSFromSlopeForMonthsBack(12);

    if (!oneMonth || !threeMonth || !sixMonth || !twelveMonth) {
      throw Error("Cound not calculate relative strength from slopes.");
    }

    etfRelativeStrengthsFromSlopeMap.set("1M", oneMonth.etfs);
    stockRelativeStrengthsFromSlopeMap.set("1M", oneMonth.stocks);

    etfRelativeStrengthsFromSlopeMap.set("3M", threeMonth.etfs);
    stockRelativeStrengthsFromSlopeMap.set("3M", threeMonth.stocks);

    etfRelativeStrengthsFromSlopeMap.set("6M", sixMonth.etfs);
    stockRelativeStrengthsFromSlopeMap.set("6M", sixMonth.stocks);

    etfRelativeStrengthsFromSlopeMap.set("1Y", twelveMonth.etfs);
    stockRelativeStrengthsFromSlopeMap.set("1Y", twelveMonth.stocks);

    oneMonth.stocks.forEach((oneMonthScore, ticker) => {
      const threeMonthScore = threeMonth?.stocks.get(ticker) || 0;
      const sixMonthScore = sixMonth?.stocks.get(ticker) || 0;
      const oneYearScore = twelveMonth?.stocks.get(ticker) || 0;

      const aggregate: RelativeStrengthsFromSlopeAggregate = {
        oneMonth: oneMonthScore,
        threeMonth: threeMonthScore,
        sixMonth: sixMonthScore,
        oneYear: oneYearScore,
        composite: Number(
          (
            0.1 * oneYearScore +
            0.2 * sixMonthScore +
            0.35 * threeMonthScore +
            0.35 * oneMonthScore
          ).toFixed(2)
        ),
      };
      this.stockRelativeStrengthsFromSlopeMap.set(ticker, aggregate);
    });

    oneMonth.etfs.forEach((oneMonthScore, ticker) => {
      const threeMonthScore = threeMonth?.stocks.get(ticker) || 0;
      const sixMonthScore = sixMonth?.stocks.get(ticker) || 0;
      const oneYearScore = twelveMonth?.stocks.get(ticker) || 0;

      const aggregate: RelativeStrengthsFromSlopeAggregate = {
        oneMonth: oneMonthScore,
        threeMonth: threeMonthScore,
        sixMonth: sixMonthScore,
        oneYear: oneYearScore,
        composite: Number(
          (
            0.2 * oneYearScore +
            0.2 * sixMonthScore +
            0.3 * threeMonthScore +
            0.3 * oneMonthScore
          ).toFixed(2)
        ),
      };
      this.etfRelativeStrengthsFromSlopeMap.set(ticker, aggregate);
    });
  }

  public initializeRelativeStrengthData() {
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();
    const cached = this.cacheSvc.getAllData();

    const universeOfStockKeys = stocks.map((s) => s.Symbol);
    const universeOfEtfKeys = etfs.map((e) => e.Symbol);

    const allKeys = Array.from(cached.keys()).filter(
      (k) => universeOfStockKeys.includes(k) || universeOfEtfKeys.includes(k)
    );
    const stockReturns = [];
    const etfReturns = [];

    console.log("building RS Data");

    for (const k of allKeys) {
      if (universeOfStockKeys.includes(k)) {
        const candles = this.cacheSvc.getCandles(k);

        const stock = stocks.find(
          (s) => s.Symbol.toLowerCase() === k.toLowerCase()
        );
        const name = stock && stock.companyName ? stock.companyName : "";
        const returnData = this.buildReturnData(k, name, candles);

        if (returnData) {
          stockReturns.push(returnData);
        }
      } else if (universeOfEtfKeys.includes(k)) {
        const candles = this.cacheSvc.getCandles(k);

        if (
          candles[candles.length - 1].volume < 100000 ||
          candles[candles.length - 1].close < 12
        ) {
          continue;
        }
        const etf = etfs.find(
          (s) => s.Symbol.toLowerCase() === k.toLowerCase()
        );
        const name = etf && etf.companyName ? etf.companyName : "";
        const returnData = this.buildReturnData(k, name, candles);

        if (returnData) {
          etfReturns.push(returnData);
        }
      }
    }

    this.stockReturns = stockReturns;
    this.etfReturns = etfReturns;

    const stockRelativeStrengthsArr: RelativeStrength[] = [];
    const etfRelativeStrengthsArr: RelativeStrength[] = [];

    for (const period of RelativeStrengthTimePeriodTypes) {
      console.log(`calculating relative strength for ${period}`);

      const stockRelativeStrengths = this.calculateRelativeStrength(
        this.stockReturns,
        period,
        (s) => {
          switch (period) {
            case "1Y":
              return s.oneYearReturns;
            case "YTD":
              return s.yearToDateReturns;
            case "6M":
              return s.sixMonthReturns;
            case "3M":
              return s.threeMonthReturns;
            case "1M":
              return s.oneMonthReturns;
            case "1W":
              return s.oneWeekReturns;
            case "1D":
              return s.oneDayReturns;
            default:
              return 0;
          }
        }
      );

      stockRelativeStrengthsArr.push(...stockRelativeStrengths);
      this.stockRelativeStrengthsMap.set(period, stockRelativeStrengths);

      const relativeStrengths = this.calculateRelativeStrength(
        this.etfReturns,
        period,
        (e) => {
          switch (period) {
            case "1Y":
              return e.oneYearReturns;
            case "YTD":
              return e.yearToDateReturns;
            case "6M":
              return e.sixMonthReturns;
            case "3M":
              return e.threeMonthReturns;
            case "1M":
              return e.oneMonthReturns;
            case "1W":
              return e.oneWeekReturns;
            case "1D":
              return e.oneDayReturns;
            default:
              return 0;
          }
        }
      );

      etfRelativeStrengthsArr.push(...relativeStrengths);
      this.etfRelativeStrengthsMap.set(period, relativeStrengths);
    }

    const stocksRSTickerMap: Map<Ticker, RelativeStrength[]> =
      stockRelativeStrengthsArr.reduce((result, item) => {
        const { symbol } = item;
        if (!result.has(symbol)) {
          result.set(symbol, []);
        }
        result.get(symbol)?.push(item);
        return result;
      }, new Map<Ticker, RelativeStrength[]>());

    const etfsRSTickerMap: Map<Ticker, RelativeStrength[]> =
      etfRelativeStrengthsArr.reduce((result, item) => {
        const { symbol } = item;
        if (!result.has(symbol)) {
          result.set(symbol, []);
        }
        result.get(symbol)?.push(item);
        return result;
      }, new Map<Ticker, RelativeStrength[]>());

    const spyCandles: Candle[] = filterCandlesPast52Weeks(
      this.cacheSvc.getCandles("SPY")
    );

    stocksRSTickerMap.forEach((value, key) => {
      const compositeRelativeStrength =
        this.calculateCompositeRelativeStrength(value);

      const symbolCandles: Candle[] = this.cacheSvc.getCandles(key);

      const sorted = filterCandlesPast52Weeks(symbolCandles);
      const closes = sorted.map((c) => c.close);
      const twentyEMA = ema(20, closes);
      const tenEMA = ema(10, closes);
      const fiftySMA = sma(50, closes);

      if (
        !isMovingAverageError(tenEMA) &&
        !isMovingAverageError(twentyEMA) &&
        !isMovingAverageError(fiftySMA)
      ) {
        var profileData = stocks.find((s) => s.Symbol === key);

        const relativeStringForSym: RelativeStrengthsForSymbol = {
          symbol: key,
          name: profileData?.companyName,
          relativeStrengths: value,
          relativeStrengthLine: getRelativeStrengthLine(
            spyCandles,
            symbolCandles
          ),
          compositeScore: compositeRelativeStrength,
          lastClose: sorted[sorted.length - 1].close,
          industry: profileData?.industry,
          sector: profileData?.sector,
          tenEMA: tenEMA,
          twentyEMA: twentyEMA,
          fiftySMA: fiftySMA,
        };

        this.stocksRSForSymbols.push(relativeStringForSym);
      }
    });

    etfsRSTickerMap.forEach((value, key) => {
      var profileData = etfs.find((e) => e.Symbol === key);

      const compositeRelativeStrength =
        this.calculateCompositeRelativeStrength(value);

      const symbolCandles: Candle[] = this.cacheSvc.getCandles(key);

      const sorted = filterCandlesPast52Weeks(symbolCandles);
      const closes = sorted.map((c) => c.close);
      const twentyEMA = ema(20, closes);
      const tenEMA = ema(10, closes);
      const fiftySMA = sma(50, closes);

      if (
        !isMovingAverageError(tenEMA) &&
        !isMovingAverageError(twentyEMA) &&
        !isMovingAverageError(fiftySMA)
      ) {
        const relativeStringForSym: RelativeStrengthsForSymbol = {
          symbol: key,
          name: profileData?.companyName,
          relativeStrengths: value,
          relativeStrengthLine: getRelativeStrengthLine(
            spyCandles,
            symbolCandles
          ),
          compositeScore: compositeRelativeStrength,
          lastClose: sorted[sorted.length - 1].close,
          industry: "",
          sector: "",
          tenEMA: tenEMA,
          twentyEMA: twentyEMA,
          fiftySMA: fiftySMA,
        };

        this.etfsRSForSymbols.push(relativeStringForSym);
      }
    });

    console.log("Relative strength calculated");
  }

  private calculateRelativeStrength(
    data: ReturnData[],
    period: RelativeStrengthTimePeriod,
    getReturnValue: (data: ReturnData) => number
  ): RelativeStrength[] {
    const sortedData = data
      .slice()
      .sort((a, b) => getReturnValue(a) - getReturnValue(b));

    // Step 2: Calculate the relative strength (percentile rank)
    const totalTickers = sortedData.length;
    const relativeStrengthData: RelativeStrength[] = sortedData.map(
      (entry, index) => ({
        symbol: entry.symbol,
        name: entry.name,
        timePeriod: period,
        relativeStrength: Number(((index / totalTickers) * 100).toFixed(4)),
        returns: Number(getReturnValue(entry).toFixed(4)),
      })
    );

    relativeStrengthData.sort(
      (a, b) => b.relativeStrength - a.relativeStrength
    );

    return relativeStrengthData;
  }

  public getRelativeStrength(
    symbol: Ticker,
    timePeriod: RelativeStrengthTimePeriod
  ) {
    const stockRelativeStrengths =
      this.stockRelativeStrengthsMap.get(timePeriod);

    const stockRS = stockRelativeStrengths?.find((rs) => rs.symbol === symbol);

    if (stockRS) {
      return stockRS;
    } else {
      const etfsRelativeStrengths =
        this.etfRelativeStrengthsMap.get(timePeriod);

      return etfsRelativeStrengths?.find((rs) => rs.symbol === symbol);
    }
  }

  public getRelativeStrengthsForSymbol(
    symbol: Ticker
  ): RelativeStrengthsForSymbol | RelativeStrengthError {
    const stockFound = this.stocksRSForSymbols.find(
      (rs) => rs.symbol === symbol
    );

    const etfFound = this.etfsRSForSymbols.find((rs) => rs.symbol === symbol);

    if (stockFound) {
      return stockFound;
    } else if (etfFound) {
      return etfFound;
    } else {
      return "Not found";
    }
  }

  public getTopStockRelativeStrengthPerformers(
    timePeriod: RelativeStrengthTimePeriod,
    top: number = 50
  ): RelativeStrength[] | string {
    function sortByRelativeStrength(a: RelativeStrength, b: RelativeStrength) {
      return b.relativeStrength - a.relativeStrength;
    }

    const relativeStrengths = this.stockRelativeStrengthsMap.get(timePeriod);

    if (relativeStrengths) {
      const maxCount = Math.min(relativeStrengths.length, top);
      return relativeStrengths.sort(sortByRelativeStrength).slice(0, maxCount);
    } else {
      return "No relative strengths found";
    }
  }

  public getTopEtfRelativeStrengthPerformers(
    timePeriod: RelativeStrengthTimePeriod,
    top: number = 50
  ): RelativeStrength[] | string {
    function sortByRelativeStrength(a: RelativeStrength, b: RelativeStrength) {
      return b.relativeStrength - a.relativeStrength;
    }

    const relativeStrengths = this.etfRelativeStrengthsMap.get(timePeriod);

    if (relativeStrengths) {
      const maxCount = Math.min(relativeStrengths.length, top);
      return relativeStrengths.sort(sortByRelativeStrength).slice(maxCount);
    } else {
      return "No relative strengths found";
    }
  }

  public getTopRelativeStrengthPerformersForTimePeriod(
    timePeriod: RelativeStrengthTimePeriod,
    top: number = 50
  ): RelativeStrengthPerformersForPeriod | RelativeStrengthError {
    function sortByReturnsDescending(a: RelativeStrength, b: RelativeStrength) {
      return b.relativeStrength - a.relativeStrength;
    }

    function isSuccess(
      data: RelativeStrength[] | RelativeStrengthError
    ): data is RelativeStrength[] {
      return typeof data !== "string";
    }

    const eftPerformers = this.getTopEtfRelativeStrengthPerformers(
      timePeriod,
      top
    );
    const stockPerformers = this.getTopStockRelativeStrengthPerformers(
      timePeriod,
      top
    );

    if (isSuccess(eftPerformers) && isSuccess(stockPerformers)) {
      return {
        stocks: stockPerformers.sort(sortByReturnsDescending).slice(0, top),
        etfs: eftPerformers.sort(sortByReturnsDescending).slice(0, top),
      };
    } else {
      return "Error calculating Relative Strength performers by period";
    }
  }

  public getStockReturns(symbol: Ticker): ReturnData | RelativeStrengthError {
    const result = this.stockReturns.find(
      (r) => r.symbol.toLocaleLowerCase() == symbol.toLocaleLowerCase()
    );

    return result ? result : `No stock returns found for ${symbol}`;
  }

  public getEtfReturns(symbol: Ticker): ReturnData | RelativeStrengthError {
    const result = this.etfReturns.find(
      (r) => r.symbol.toLocaleLowerCase() == symbol.toLocaleLowerCase()
    );

    return result ? result : `No etf returns found for ${symbol}`;
  }

  public calculateCompositeRelativeStrength(
    relativeStrengths: RelativeStrength[]
  ): number {
    const RelativeStrengthTimePeriodWeights: Record<
      RelativeStrengthTimePeriod,
      number
    > = {
      "1Y": 0.2,
      "6M": 0.2,
      "3M": 0.3,
      "1M": 0.3,
      "1W": 0,
      "1D": 0,
      YTD: 0,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const period of Object.keys(
      RelativeStrengthTimePeriodWeights
    ) as RelativeStrengthTimePeriod[]) {
      const strength =
        relativeStrengths.find((rs) => rs.timePeriod === period)
          ?.relativeStrength || 0;
      const weight = RelativeStrengthTimePeriodWeights[period];

      // Calculate the sum of relative strength scores multiplied by their weights
      weightedSum += weight * strength;

      // Calculate the total weight
      totalWeight += weight;
    }

    // Calculate the weighted average
    const compositeRelativeStrength = weightedSum / totalWeight;

    return compositeRelativeStrength;
  }

  public getCompositeRelativeStrengthForSymbol(symbol: Ticker): number {
    const relativeStrengths = this.getRelativeStrengthsForSymbol(symbol);

    if (!isRelativeStrengthsForSymbol(relativeStrengths)) {
      return 0;
    } else {
      return this.calculateCompositeRelativeStrength(
        relativeStrengths.relativeStrengths
      );
    }
  }

  public getTopCompositeRelativeStrengthPerformers(
    top: number = 50
  ): RelativeStrengthPerformers {
    function sortByCompositeScoreDescending(
      a: RelativeStrengthsForSymbol,
      b: RelativeStrengthsForSymbol
    ) {
      return b.compositeScore - a.compositeScore;
    }

    const stocksData = this.stocksRSForSymbols
      .sort(sortByCompositeScoreDescending)
      .slice(0, top);

    const etfsData = this.etfsRSForSymbols
      .sort(sortByCompositeScoreDescending)
      .slice(0, top);

    function transform(data: RelativeStrengthsForSymbol[]) {
      return data.flatMap((s) => {
        const lineData = s.relativeStrengthLine.data.map((d) => d.value);
        const max = Math.max(...lineData);
        const min = Math.min(...lineData);
        const last = lineData[lineData.length - 1];
        const percent = ((last - min) / (max - min)) * 100;
        const lr = calculateLinearRegressionFromNumbers(
          lineData,
          lineData.length
        );

        if (isLinearRegressionResult(lr)) {
          const lineStats: RelativeStrengthLineStats = {
            fiftyDaySlope: lr.slope,
            percentOfFiftyTwoWeekRange: Number(percent.toFixed(2)),
          };

          const result: RelativeStrengthsForSymbolStats = {
            symbol: s.symbol,
            relativeStrengths: s.relativeStrengths,
            relativeStrengthLineStats: lineStats,
            compositeScore: s.compositeScore,
            lastClose: s.lastClose,
            industry: s.industry,
            sector: s.sector,
            tenEMA: s.tenEMA,
            twentyEMA: s.twentyEMA,
            fiftySMA: s.fiftySMA,
          };

          return [result];
        } else {
          return [];
        }
      });
    }

    const result: RelativeStrengthPerformers = {
      stocks: transform(stocksData),
      etfs: transform(etfsData),
    };

    return result;
  }

  public getRelativeStrengthStatsForSymbol(
    symbol: Ticker
  ): RelativeStrengthError | RelativeStrengthsForSymbolStats {
    const relativeStrengthsData = this.getRelativeStrengthsForSymbol(symbol);

    if (isRelativeStrengthsForSymbol(relativeStrengthsData)) {
      const lineData = relativeStrengthsData.relativeStrengthLine.data.map(
        (d) => d.value
      );
      const max = Math.max(...lineData);
      const min = Math.min(...lineData);
      const last = lineData[lineData.length - 1];
      const percent = ((last - min) / (max - min)) * 100;
      const lr = calculateLinearRegressionFromNumbers(
        lineData,
        lineData.length
      );

      if (isLinearRegressionResult(lr)) {
        const lineStats: RelativeStrengthLineStats = {
          fiftyDaySlope: lr.slope,
          percentOfFiftyTwoWeekRange: percent,
        };

        const result: RelativeStrengthsForSymbolStats = {
          symbol: symbol,
          relativeStrengths: relativeStrengthsData.relativeStrengths,
          relativeStrengthLineStats: lineStats,
          compositeScore: relativeStrengthsData.compositeScore,
          lastClose: relativeStrengthsData.lastClose,
          tenEMA: relativeStrengthsData.tenEMA,
          twentyEMA: relativeStrengthsData.twentyEMA,
          fiftySMA: relativeStrengthsData.fiftySMA,
        };

        return result;
      } else {
        return `Unable to calculate LR for ${symbol} relative strengths`;
      }
    } else {
      return `Unable to get relative strength stats for ${symbol}`;
    }
  }

  public getRelativeStrengthLineLeaders(
    top: number = 50,
    minClosePrice = 10
  ): RelativeStrengthPerformers {
    function sortByLineStrength(
      a: RelativeStrengthsForSymbolStats,
      b: RelativeStrengthsForSymbolStats
    ) {
      return (
        b.relativeStrengthLineStats.percentOfFiftyTwoWeekRange -
        a.relativeStrengthLineStats.percentOfFiftyTwoWeekRange
      );
    }

    function transform(data: RelativeStrengthsForSymbol[]) {
      return data.flatMap((s) => {
        const lineData = s.relativeStrengthLine.data.map((d) => d.value);
        const max = Math.max(...lineData);
        const min = Math.min(...lineData);
        const last = lineData[lineData.length - 1];
        const percent = ((last - min) / (max - min)) * 100;
        const lr = calculateLinearRegressionFromNumbers(
          lineData,
          lineData.length
        );

        if (isLinearRegressionResult(lr)) {
          const lineStats: RelativeStrengthLineStats = {
            fiftyDaySlope: lr.slope,
            percentOfFiftyTwoWeekRange: percent,
          };

          const result: RelativeStrengthsForSymbolStats = {
            symbol: s.symbol,
            name: s.name,
            industry: s.industry,
            sector: s.sector,
            relativeStrengths: s.relativeStrengths,
            relativeStrengthLineStats: lineStats,
            compositeScore: Number(s.compositeScore.toFixed(2)),
            lastClose: s.lastClose,
            tenEMA: Number(s.tenEMA.toFixed(2)),
            twentyEMA: Number(s.twentyEMA.toFixed(2)),
            fiftySMA: Number(s.fiftySMA.toFixed(2)),
          };

          return [result];
        } else {
          return [];
        }
      });
    }

    const stocksData = transform(this.stocksRSForSymbols)
      .sort(sortByLineStrength)
      .slice(0, top);

    const etfsData = transform(this.etfsRSForSymbols)
      .sort(sortByLineStrength)
      .slice(0, top);

    const result: RelativeStrengthPerformers = {
      stocks: stocksData,
      etfs: etfsData,
    };

    return result;
  }

  private calculateRelativeStrengthsByLineSlope(
    dataset: Map<Ticker, Candle[]>,
    benchmark: Candle[]
  ): Either<DataError, Map<Ticker, number>> {
    if (!benchmark || benchmark.length == 0) {
      return Left({
        errorMessage: "Cannot calculate relative strength without a benchmark",
      });
    }

    const benchmarkCloses: Map<string, number> = new Map();
    for (let i = 0; i < benchmark.length; i++) {
      benchmarkCloses.set(benchmark[i].dateStr!, benchmark[i].close);
    }

    //get a relative strength line
    const rsLineMap: Map<Ticker, RelativeStrengthPoint[]> = new Map();

    dataset.forEach((candles, ticker) => {
      const relativeStrengthLine: RelativeStrengthPoint[] = [];
      candles.sort((a, b) => a.date - b.date);

      for (let j = 0; j < candles.length; j++) {
        const benchMarkClose = benchmarkCloses.get(candles[j].dateStr!);
        if (!benchMarkClose) {
          console.error(
            `No benchmark close found for ${candles[j].dateStr} - ticker ${ticker}`
          );
        } else {
          const sliced = candles.slice(0, j + 1);
          const benchmarks: number[] = [];
          const slicedSanitized: number[] = [];
          sliced.forEach((s) => {
            const bench = benchmark.find((b) => b.dateStr === s.dateStr);
            if (bench) {
              benchmarks.push(bench.close - bench.open);
              slicedSanitized.push(s.close - s.open);
            }
          });

          const point: RelativeStrengthPoint = {
            date: candles[j].date,
            dateString: candles[j].dateStr!,
            rsRatio: candles[j].close / benchMarkClose,
          };
          relativeStrengthLine.push(point);
        }
      }
      if (relativeStrengthLine.length > 0) {
        rsLineMap.set(ticker, relativeStrengthLine);
      }
    });

    //now take the linear regression of the lines and map the slope
    const linearRegressionMap: Map<Ticker, number> = new Map();
    rsLineMap.forEach((rsLinePoints, ticker) => {
      const rsLinePointValues = rsLinePoints.map((point) => point.rsRatio);
      const linearReg = calculateLinearRegressionFromNumbers(
        rsLinePointValues,
        rsLinePointValues.length
      );

      if (isLinearRegressionResult(linearReg)) {
        linearRegressionMap.set(ticker, linearReg.slope);
      } else {
        console.error(
          `Unable to calculate the linear regression for ${ticker} - ${linearReg}`
        );
      }
    });

    // Sort the map by slope values
    const sortedMap = sortMapByValue(linearRegressionMap);

    // Assign ranks to the sorted tickers
    const rankedMap: Map<Ticker, number> = new Map(
      [...sortedMap].map(([ticker], index) => [ticker, index + 1])
    );

    const totalTickers = rankedMap.size;

    function calculatePercentileRank(rank: number, total: number): number {
      return (rank / total) * 100;
    }

    // Calculate percentile ranks for each ticker
    const percentileRanks: Map<Ticker, number> = new Map();
    rankedMap.forEach((rank, ticker) => {
      const percentileRank = calculatePercentileRank(rank, totalTickers);
      percentileRanks.set(ticker, Number(percentileRank.toFixed(2)));
    });

    return Right(percentileRanks);
  }

  public getRelativeStrengthFromSlope(
    ticker: Ticker
  ): RelativeStrengthsFromSlopeAggregate | undefined {
    const stockRS = this.stockRelativeStrengthsFromSlopeMap.get(ticker);

    return stockRS
      ? stockRS
      : this.etfRelativeStrengthsFromSlopeMap.get(ticker);
  }
}
