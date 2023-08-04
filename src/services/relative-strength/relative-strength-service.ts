import { inject, injectable } from "inversify";
import { DailyCacheService } from "../daily_cache_service";
import TYPES from "../../types";
import { Ticker } from "../../MarketGeneratedTypes";
import { SymbolService } from "../symbol/symbol_service";
import {
  calculatePercentageReturn,
  filterCandlesPast52Weeks,
  filterCandlesPastMonths,
  filterCandlesPastWeeks,
  filterCandlesYearToDate,
  isIndicatorError,
} from "../../indicators/indicator-utils";
import { Candle } from "../../modles/candle";
import {
  CompositeRelativeStrengthPerformers,
  RelativeStrength,
  RelativeStrengthError,
  RelativeStrengthLinePoint,
  RelativeStrengthPerformersForPeriod,
  RelativeStrengthTimePeriod,
  RelativeStrengthTimePeriodTypes,
  RelativeStrengthsForSymbol,
  ReturnData,
  isRelativeStrengthsForSymbol,
} from "./relative-strength-types";
import { getRelativeStrengthLine } from "../../indicators/relative-strength";

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
    const nineMonthsAgo = filterCandlesPastMonths(filtered, 9);
    const fiveMonthsAgo = filterCandlesPastMonths(filtered, 5);
    const threeMonthsAgo = filterCandlesPastMonths(filtered, 3);
    const oneMonthsAgo = filterCandlesPastMonths(filtered, 1);
    const twoWeekAgo = filterCandlesPastWeeks(filtered, 2);
    const oneWeekAgo = filterCandlesPastWeeks(filtered, 1);
    const oneDayAgo = filtered.slice(-2);

    if (!filtered || filtered.length < 240) {
      return undefined;
    }

    const oneYearReturns = calculatePercentageReturn(filtered);
    const yearToDateReturns = calculatePercentageReturn(yearToDate);
    const nineMonthReturns = calculatePercentageReturn(nineMonthsAgo);
    const sixMonthReturns = calculatePercentageReturn(sixMonthsAgo);
    const fiveMonthReturns = calculatePercentageReturn(fiveMonthsAgo);
    const threeMonthReturns = calculatePercentageReturn(threeMonthsAgo);
    const oneMonthReturns = calculatePercentageReturn(oneMonthsAgo);
    const twoWeekReturns = calculatePercentageReturn(twoWeekAgo);
    const oneWeekReturns = calculatePercentageReturn(oneWeekAgo);
    const oneDayReturns = calculatePercentageReturn(oneDayAgo);

    if (
      isIndicatorError(oneYearReturns) ||
      isIndicatorError(yearToDateReturns) ||
      isIndicatorError(nineMonthReturns) ||
      isIndicatorError(sixMonthReturns) ||
      isIndicatorError(fiveMonthReturns) ||
      isIndicatorError(threeMonthReturns) ||
      isIndicatorError(oneMonthReturns) ||
      isIndicatorError(twoWeekReturns) ||
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
        nineMonthReturns: isIndicatorError(nineMonthReturns)
          ? 0
          : nineMonthReturns,
        sixMonthReturns: isIndicatorError(sixMonthReturns)
          ? 0
          : sixMonthReturns,
        fiveMonthReturns: isIndicatorError(fiveMonthReturns)
          ? 0
          : fiveMonthReturns,
        threeMonthReturns: isIndicatorError(threeMonthReturns)
          ? 0
          : threeMonthReturns,
        oneMonthReturns: isIndicatorError(oneMonthReturns)
          ? 0
          : oneMonthReturns,
        twoWeekReturns: isIndicatorError(twoWeekReturns) ? 0 : twoWeekReturns,
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
        nineMonthReturns: nineMonthReturns,
        sixMonthReturns: sixMonthReturns,
        fiveMonthReturns: fiveMonthReturns,
        threeMonthReturns: threeMonthReturns,
        oneMonthReturns: oneMonthReturns,
        twoWeekReturns: twoWeekReturns,
        oneWeekReturns: oneWeekReturns,
        oneDayReturns: oneDayReturns,
      };

      return returnData;
    }
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
            case "9M":
              return s.nineMonthReturns;
            case "6M":
              return s.sixMonthReturns;
            case "5M":
              return s.fiveMonthReturns;
            case "3M":
              return s.threeMonthReturns;
            case "1M":
              return s.oneMonthReturns;
            case "2W":
              return s.twoWeekReturns;
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
            case "9M":
              return e.sixMonthReturns;
            case "6M":
              return e.sixMonthReturns;
            case "3M":
              return e.threeMonthReturns;
            case "5M":
              return e.fiveMonthReturns;
            case "1M":
              return e.oneMonthReturns;
            case "2W":
              return e.twoWeekReturns;
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

      const relativeStringForSym: RelativeStrengthsForSymbol = {
        symbol: key,
        relativeStrengths: value,
        relativeStrengthLine: getRelativeStrengthLine(
          spyCandles,
          symbolCandles
        ),
        compositeScore: compositeRelativeStrength,
      };

      this.stocksRSForSymbols.push(relativeStringForSym);
    });

    etfsRSTickerMap.forEach((value, key) => {
      const compositeRelativeStrength =
        this.calculateCompositeRelativeStrength(value);

      const symbolCandles: Candle[] = this.cacheSvc.getCandles(key);

      const relativeStringForSym: RelativeStrengthsForSymbol = {
        symbol: key,
        relativeStrengths: value,
        relativeStrengthLine: getRelativeStrengthLine(
          spyCandles,
          symbolCandles
        ),
        compositeScore: compositeRelativeStrength,
      };

      this.etfsRSForSymbols.push(relativeStringForSym);
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
      "9M": 0.2,
      "6M": 0.2,
      "5M": 0,
      "3M": 0.4,
      "1M": 0,
      "2W": 0,
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
  ): CompositeRelativeStrengthPerformers {
    function sortByCompositeScoreDescending(
      a: RelativeStrengthsForSymbol,
      b: RelativeStrengthsForSymbol
    ) {
      return b.compositeScore - a.compositeScore;
    }

    const result: CompositeRelativeStrengthPerformers = {
      stocks: this.stocksRSForSymbols
        .sort(sortByCompositeScoreDescending)
        .slice(0, top),
      etfs: this.etfsRSForSymbols
        .sort(sortByCompositeScoreDescending)
        .slice(0, top),
    };

    return result;
  }
}
