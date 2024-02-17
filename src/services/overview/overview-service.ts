import { inject, injectable } from "inversify";
import TYPES from "../../types";
import {
  EtfHoldingInfo,
  StockSymbol,
  SymbolService,
} from "../symbol/symbol_service";
import { DailyCacheService } from "../daily_cache_service";
import { Candle } from "../../modles/candle";
import {
  ETFDailyOverview,
  ConstituentPriceReturn,
  ETFOverviewPriceReturns,
  DailyMover,
  MarketDailyMovers,
  DailyActivesAndMovers,
  DailySectorOverview,
  DailySectorsOverview,
  IndexDailyOverview,
  IndexDailyOverviewPriceReturns,
  PercentAboveSMALine,
  PercentAboveMAPoint,
  AdvanceDeclineOverview,
} from "../../controllers/overview/overview-responses";
import { Ticker } from "../../MarketGeneratedTypes";
import { calculateMedian } from "../../utils/math_utils";
import { filterCandlesPast52Weeks } from "../../indicators/indicator-utils";
import {
  MajorStockIndex,
  StockIndexConstituentList,
  isStockIndexConstituentList,
} from "../stock-index/stock-index-types";
import { StockIndexService } from "../stock-index/stock-index-service";
import { FMPHistoricalArray } from "../financial_modeling_prep_types";
import { dateSringToMillisSinceEpochInET } from "../../utils/epoch_utils";
import { DataError, isDataError } from "../data_error";
import e = require("express");
import {
  calculateSMA,
  isMovingAverageError,
} from "../../indicators/moving-average";

export type OverviewServiceError = string;

@injectable()
export class OverviewService {
  private dailyStockMovers: DailyMover[];
  private dailyETFMovers: DailyMover[];

  private percentAboveSMAMap: Map<
    MajorStockIndex,
    Map<number, PercentAboveSMALine>
  > = new Map();

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService,
    @inject(TYPES.StockIndexService) private stockIndexSvc: StockIndexService
  ) {
    this.buildMovers();
    this.buildPercentAboveSMAMap();
  }

  private buildMovers() {
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();
    const cached = this.cacheSvc.getAllData();

    const universeOfStockKeys = stocks.map((s) => s.Symbol);
    const universeOfEtfKeys = etfs.map((e) => e.Symbol);

    const allKeys = Array.from(cached.keys()).filter(
      (k) => universeOfStockKeys.includes(k) || universeOfEtfKeys.includes(k)
    );
    const stockMovers = [];
    const etfMovers = [];

    function buildMoverRow(
      symbol: Ticker,
      name: string,
      lastFiftyTwoWeeksCandles: Candle[]
    ): DailyMover {
      const [head, tail] = lastFiftyTwoWeeksCandles.slice(-2);
      const change = tail.close - head.close;
      const percentChange = change / head.close;

      const yearLow = Math.min(...lastFiftyTwoWeeksCandles.map((c) => c.low));
      const yearMax = Math.max(...lastFiftyTwoWeeksCandles.map((c) => c.high));

      const lastTwenty = lastFiftyTwoWeeksCandles.slice(-20);
      const volumes = lastTwenty.map((c) => c.volume);
      const volumeSum = volumes.reduce((acc, val) => acc + val, 0);
      const meanVolume = volumeSum / volumes.length;

      const mover: DailyMover = {
        symbol: symbol,
        name: name,
        volume: volumes[volumes.length - 1],
        avgVolume: Number(meanVolume.toFixed(4)),
        change: Number(change.toFixed(4)),
        percentChange: Number(percentChange.toFixed(4)),
        lastClose:
          lastFiftyTwoWeeksCandles[lastFiftyTwoWeeksCandles.length - 1].close,
        fiftyTwoWeekHigh: yearMax,
        fiftyTwoWeekLow: yearLow,
        lastCloseDate:
          lastFiftyTwoWeeksCandles[lastFiftyTwoWeeksCandles.length - 1].date,
      };

      return mover;
    }

    //build movers
    for (const k of allKeys) {
      if (universeOfStockKeys.includes(k)) {
        const name = stocks.find((s) => s.Symbol === k)!.companyName;
        const candles = this.cacheSvc.getCandles(k);
        const filtered = filterCandlesPast52Weeks(candles);

        if (!filtered || filtered.length < 20 || !name) {
          continue;
        }
        const mover: DailyMover = buildMoverRow(k, name, filtered);
        stockMovers.push(mover);
      } else if (universeOfEtfKeys.includes(k)) {
        const name = etfs.find((s) => s.Symbol === k)!.companyName;
        const candles = this.cacheSvc.getCandles(k);
        const filtered = filterCandlesPast52Weeks(candles);

        if (!filtered || filtered.length < 20 || !name) {
          continue;
        }
        const mover: DailyMover = buildMoverRow(k, name, filtered);
        etfMovers.push(mover);
      }
    }

    this.dailyStockMovers = stockMovers;
    this.dailyETFMovers = etfMovers;
  }

  private async buildPercentAboveSMAMap() {
    // Get the current date
    const currentDate = new Date();

    // Calculate the date 2 years and one day ago
    const twoYearsOneDayAgo = new Date(
      currentDate.getFullYear() - 2,
      currentDate.getMonth(),
      currentDate.getDate() - 1, // Subtract 1 day to go one day ago
      currentDate.getHours(),
      currentDate.getMinutes(),
      currentDate.getSeconds(),
      currentDate.getMilliseconds()
    );

    // Get the time in milliseconds
    const startMillis = twoYearsOneDayAgo.getTime();
    const endMillis = currentDate.getTime();
    const sp500PercentAbove50 = this.getPercentAboveSMALine(
      "SP500",
      "50",
      startMillis,
      endMillis
    );
    const sp500PercentAbove200 = this.getPercentAboveSMALine(
      "SP500",
      "200",
      startMillis,
      endMillis
    );

    const ns100PercentAbove50 = this.getPercentAboveSMALine(
      "NS100",
      "50",
      startMillis,
      endMillis
    );
    const ns100PercentAbove200 = this.getPercentAboveSMALine(
      "NS100",
      "200",
      startMillis,
      endMillis
    );

    const [sp50, sp200, ns50, ns200] = await Promise.all([
      sp500PercentAbove50,
      sp500PercentAbove200,
      ns100PercentAbove50,
      ns100PercentAbove200,
    ]);

    const sp500Map: Map<number, PercentAboveSMALine> = new Map();
    const ns100Map: Map<number, PercentAboveSMALine> = new Map();

    if (!isDataError(sp50)) {
      sp500Map.set(50, sp50);
    } else {
      console.error(
        "unable to calculate percent of S&P constituents above 50SMA"
      );
    }

    if (!isDataError(sp200)) {
      sp500Map.set(200, sp200);
    } else {
      console.error(
        "unable to calculate percent of S&P constituents above 200SMA"
      );
    }

    if (!isDataError(ns50)) {
      ns100Map.set(50, ns50);
    } else {
      console.error(
        "unable to calculate percent of NS100 constituents above 50SMA"
      );
    }

    if (!isDataError(ns200)) {
      ns100Map.set(200, ns200);
    } else {
      console.error(
        "unable to calculate percent of NS100 constituents above 200SMA"
      );
    }

    this.percentAboveSMAMap.set("SP500", sp500Map);
    this.percentAboveSMAMap.set("NS100", ns100Map);
  }

  private getOverview(etfTicker: Ticker, etfHoldings: EtfHoldingInfo[]) {
    const candles: Candle[] = this.cacheSvc.getCandles(etfTicker);
    const returns = this.calculateDailyReturns(candles);
    const sorted = [...candles].sort((a, b) => {
      if (a.date > b.date) {
        return 1;
      } else if (a.date < b.date) {
        return -1;
      }
      return 0;
    });
    const [head, tail] = sorted.slice(-2);
    const lastChange = tail.close - head.close;

    const allReturns = etfHoldings.flatMap((eHolding) => {
      const candles = this.cacheSvc.getCandles(eHolding.ticker);
      const dailyReturn = this.calculateDailyReturns(candles);

      if (dailyReturn === undefined) {
        return [];
      }

      const lastCandle: Candle = candles[candles.length - 1];

      const etfReturn: ConstituentPriceReturn = {
        symbol: eHolding.ticker,
        dayReturn: Number(dailyReturn.toFixed(4)),
        volume: lastCandle.volume,
        closeDate: lastCandle.date,
      };

      return [etfReturn];
    });

    const overview: ETFDailyOverview = {
      symbol: etfTicker,
      lastCandle: tail,
      lastReturn: Number(returns!.toFixed(4)),
      lastChange: Number(lastChange.toFixed(4)),
      holdingReturns: allReturns,
    };
    return overview;
  }

  private getMajorIndexOverview(
    indexTicker: Ticker,
    candles: Candle[],
    constituents: StockIndexConstituentList
  ) {
    console.log(`calculating daily returns for ${indexTicker}`);
    const returns = this.calculateDailyReturns(candles);
    const sorted = [...candles].sort((a, b) => {
      if (a.date > b.date) {
        return 1;
      } else if (a.date < b.date) {
        return -1;
      }
      return 0;
    });
    const [head, tail] = sorted.slice(-2);
    const lastChange = tail.close - head.close;

    const allReturns = constituents.flatMap((constituent) => {
      const candles = this.cacheSvc.getCandles(constituent.symbol);
      const dailyReturn = this.calculateDailyReturns(candles);

      if (dailyReturn === undefined) {
        return [];
      }

      const lastCandle: Candle = candles[candles.length - 1];

      const constReturn: ConstituentPriceReturn = {
        symbol: constituent.symbol,
        dayReturn: Number(dailyReturn.toFixed(4)),
        volume: lastCandle.volume,
        closeDate: lastCandle.date,
      };

      return [constReturn];
    });

    const overview: IndexDailyOverview = {
      symbol: indexTicker,
      lastCandle: tail,
      lastReturn: Number(returns!.toFixed(4)),
      lastChange: Number(lastChange.toFixed(4)),
      holdingReturns: allReturns,
    };
    return overview;
  }

  private calculateDailyReturns(candles: Candle[]): number | undefined {
    if (!candles || candles.length < 2) {
      return undefined;
    }
    const sorted = [...candles].sort((a, b) => {
      if (a.date > b.date) {
        return 1;
      } else if (a.date < b.date) {
        return -1;
      }
      return 0;
    });
    const [head, tail] = sorted.slice(-2);

    return (tail.close - head.close) / head.close;
  }

  public async getIndexOverviewReturns(): Promise<
    IndexDailyOverviewPriceReturns | OverviewServiceError
  > {
    const dowP = this.stockIndexSvc.getConstituents("DOW");
    const sAndPP = this.stockIndexSvc.getConstituents("SP500");
    const nasP = this.stockIndexSvc.getConstituents("NS100");

    const indexHistory = this.stockIndexSvc.getHistoricalIndexData();

    const [dow, sp500, nas, history] = await Promise.all([
      dowP,
      sAndPP,
      nasP,
      indexHistory,
    ]);

    const isHistoryError = (value: any): value is string => {
      return typeof value === "string";
    };

    const mapHistoryToCandles = (history: FMPHistoricalArray) => {
      return history.map((h) => {
        const c: Candle = {
          date: dateSringToMillisSinceEpochInET(h.date),
          dateStr: h.date,
          open: h.open,
          high: h.high,
          low: h.low,
          close: h.adjClose,
          volume: h.volume,
        };
        return c;
      });
    };

    if (
      isStockIndexConstituentList(dow) &&
      isStockIndexConstituentList(sp500) &&
      isStockIndexConstituentList(nas) &&
      !isHistoryError(history)
    ) {
      const sAndPHistory = history.historicalStockList.find(
        (h) => h.symbol === "^GSPC"
      );

      const dowHistory = history.historicalStockList.find(
        (h) => h.symbol === "^DJI"
      );

      const nasHistory = history.historicalStockList.find(
        (h) => h.symbol === "^IXIC"
      );

      if (!sAndPHistory || !dowHistory || !nasHistory) {
        return "Unable to fetch index history";
      } else {
        const dowOverview = this.getMajorIndexOverview(
          "^DJI",
          mapHistoryToCandles(dowHistory.historical),
          dow
        );
        const nasOverview = this.getMajorIndexOverview(
          "^IXIC",
          mapHistoryToCandles(nasHistory.historical),
          nas
        );
        const sandPOverview = this.getMajorIndexOverview(
          "^GSPC",
          mapHistoryToCandles(sAndPHistory.historical),
          sp500
        );

        const returnsOverview: IndexDailyOverviewPriceReturns = {
          returns: [dowOverview, sandPOverview, nasOverview],
          lastCloseDate: dowOverview.lastCandle.dateStr as string,
        };

        return returnsOverview;
      }
    } else {
      return "Unable to parse constituents or index history";
    }
  }

  public getDailyMarketMovers(count: number = 25): MarketDailyMovers {
    // sort asc by percent change
    const stocksSortedByPercentChange = [...this.dailyStockMovers].sort(
      (a, b) => {
        if (a.percentChange > b.percentChange) {
          return 1;
        } else if (a.percentChange < b.percentChange) {
          return -1;
        }
        return 0;
      }
    );

    const etfsSortedByPercentChange = [...this.dailyETFMovers].sort((a, b) => {
      if (a.percentChange > b.percentChange) {
        return 1;
      } else if (a.percentChange < b.percentChange) {
        return -1;
      }
      return 0;
    });

    //const sort asc by volume
    const stocksSortedByVol = [...this.dailyStockMovers].sort((a, b) => {
      if (a.volume > b.volume) {
        return 1;
      } else if (a.volume < b.volume) {
        return -1;
      }
      return 0;
    });
    const etfsSortedByVol = [...this.dailyETFMovers].sort((a, b) => {
      if (a.volume > b.volume) {
        return 1;
      } else if (a.volume < b.volume) {
        return -1;
      }
      return 0;
    });

    const stockDailyMovers: DailyActivesAndMovers = {
      gainers: stocksSortedByPercentChange.slice(-count),
      losers: stocksSortedByPercentChange.slice(count),
      actives: stocksSortedByVol.slice(-count),
    };

    const etfDailyMovers: DailyActivesAndMovers = {
      gainers: etfsSortedByPercentChange.slice(-count),
      losers: etfsSortedByPercentChange.slice(count),
      actives: etfsSortedByVol.slice(-count),
    };

    const marketMovers: MarketDailyMovers = {
      stockMovers: stockDailyMovers,
      etfMovers: etfDailyMovers,
    };

    return marketMovers;
  }

  public getDailySectorOverview(): DailySectorsOverview {
    type StockSymbolWithReturn = StockSymbol & {
      dayReturn: number;
    };

    const lastCloseDate = Math.max(
      ...this.cacheSvc.getCandles("SPY").map((c) => c.date)
    );

    const stocks = this.symbolSvc.getStocks();
    const sectorMap: Map<string, StockSymbolWithReturn[]> = new Map();

    for (const stock of stocks) {
      const candles = this.cacheSvc.getCandles(stock.Symbol);

      if (
        candles &&
        candles.length > 1 &&
        candles[candles.length - 1].date == lastCloseDate &&
        stock.sector
      ) {
        const returns = this.calculateDailyReturns(candles);
        if (returns) {
          const stockWithReturn: StockSymbolWithReturn = {
            symbol: stock.Symbol,
            name: stock.companyName,
            sector: stock.sector,
            industry: stock.industry || "",
            dayReturn: returns,
          };
          const sectorStocks = sectorMap.get(stock.sector) || [];
          sectorStocks.push(stockWithReturn);
          sectorMap.set(stock.sector, sectorStocks);
        }
      }
    }

    const mapped: DailySectorOverview[] = [];

    for (const [sector, symbolsWithReturns] of sectorMap.entries()) {
      const allReturns = symbolsWithReturns.map((swr) => swr.dayReturn);
      const returnsSum = allReturns.reduce((acc, val) => acc + val, 0);
      const meanReturn = returnsSum / allReturns.length;
      const medianReturn = calculateMedian(allReturns);

      if (medianReturn !== null) {
        const overview: DailySectorOverview = {
          sector,
          meanDayReturn: Number(meanReturn.toFixed(4)),
          medianDayReturn: Number(medianReturn.toFixed(4)),
          allReturns: allReturns.map((r) => Number(r.toFixed(4))),
        };
        mapped.push(overview);
      }
    }

    return { sectors: mapped };
  }

  public async getPercentAboveSMALine(
    index: MajorStockIndex = "SP500",
    period: string,
    startDateInMillis: number,
    endDateInMillis: number
  ): Promise<PercentAboveSMALine | DataError> {
    console.log("calculating percent above 50sma");
    const parsedPeriod = parseInt(period, 10);
    const sAndPP = await this.stockIndexSvc.getConstituents(index);

    if (!isStockIndexConstituentList(sAndPP)) {
      return {
        errorMessage: "Unable to calculate percent above 50sma",
      };
    }

    type SMADataPoint = {
      symbol: string;
      date: number;
      dateString: string;
      close: number;
      smaValue: number;
      percentFromSMA: number;
    };

    let allDataPoints: SMADataPoint[] = [];

    for (const constituent of sAndPP) {
      const candles: Candle[] = this.cacheSvc.getCandles(constituent.symbol);
      const filtered = candles.filter(
        (c) => c.date >= startDateInMillis && c.date <= endDateInMillis
      );

      const sorted = [...filtered].sort((a, b) => {
        if (a.date > b.date) {
          return 1;
        } else if (a.date < b.date) {
          return -1;
        }
        return 0;
      });

      const fiftySMA = calculateSMA(sorted, parsedPeriod);

      if (isMovingAverageError(fiftySMA)) {
        console.log("Not enough candles to calculate SMA");
        continue;
      }

      for (const t of fiftySMA.timeseries) {
        const c = candles.find((c) => c.dateStr === t.time);

        if (!c || !c.dateStr) {
          console.log("unexpected error");
          continue;
        }
        const percentAwayFromSMA = ((c.close - t.value) / t.value) * 100;

        const dataPoint: SMADataPoint = {
          symbol: constituent.symbol,
          date: c.date,
          dateString: c.dateStr!,
          close: c.close,
          percentFromSMA: percentAwayFromSMA,
          smaValue: t.value,
        };

        allDataPoints.push(dataPoint);
      }
    }

    const groupedByDate: { [dateString: string]: SMADataPoint[] } =
      allDataPoints.reduce((result, dataPoint) => {
        const dateKey = dataPoint.dateString;

        if (!result[dateKey]) {
          result[dateKey] = [];
        }

        result[dateKey].push(dataPoint);

        return result;
      }, {} as { [dateString: string]: SMADataPoint[] });

    const percentAboveSMAArray: PercentAboveMAPoint[] = Object.entries(
      groupedByDate
    ).map(([dateString, dataPoints]) => {
      const totalDataPoints = dataPoints.length;
      const aboveSMADataPoints = dataPoints.filter(
        (dp) => dp.percentFromSMA > 0
      ).length;

      const percentAboveSMA = (aboveSMADataPoints / totalDataPoints) * 100 || 0;

      return {
        dateStr: dateString,
        percentAboveMA: percentAboveSMA,
      };
    });

    return {
      timeSeries: percentAboveSMAArray,
    };
  }
}
