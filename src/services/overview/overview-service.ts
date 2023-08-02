import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { EtfHoldingInfo, StockSymbol, SymbolService } from "../symbol_service";
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
} from "../../controllers/overview/overview-responses";
import { Ticker } from "../../MarketGeneratedTypes";
import { calculateMedian } from "../../utils/math_utils";
import { filterCandlesPast52Weeks } from "../../indicators/indicator-utils";
import {
  StockIndexConstituentList,
  isStockIndexConstituentList,
} from "../stock-index/stock-index-types";
import { StockIndexService } from "../stock-index/stock-index-service";
import {
  FMPHistorical,
  FMPHistoricalArray,
} from "../financial_modeling_prep_types";
import { dateSringToMillisSinceEpochInET } from "../../utils/epoch_utils";

export type OverviewServiceError = string;

@injectable()
export class OverviewService {
  private dailyStockMovers: DailyMover[];
  private dailyETFMovers: DailyMover[];

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService,
    @inject(TYPES.StockIndexService) private stockIndexSvc: StockIndexService
  ) {
    this.buildMovers();
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

  public getOverviewReturns() {
    const dowHoldings = this.symbolSvc.getDIAHoldings();
    const qqqHoldings = this.symbolSvc.getQQQHoldings();
    const spyHoldings = this.symbolSvc.getSPYHoldings();

    const dowOverview: ETFDailyOverview = this.getOverview("DIA", dowHoldings);
    const qqqOverview: ETFDailyOverview = this.getOverview("QQQ", qqqHoldings);
    const spyOverview: ETFDailyOverview = this.getOverview("SPY", spyHoldings);

    const returnsOverview: ETFOverviewPriceReturns = {
      returns: [dowOverview, spyOverview, qqqOverview],
      lastCloseDate: spyOverview.lastCandle.date,
    };

    return returnsOverview;
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
          lastCloseDate: dowOverview.lastCandle.date,
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
    const stockKeys = stocks.map((s) => s.Symbol);

    const sectorMap: Map<string, StockSymbolWithReturn[]> = new Map();

    for (const k of stockKeys) {
      const candles = this.cacheSvc.getCandles(k);

      if (
        candles &&
        candles.length > 1 &&
        candles[candles.length - 1].date == lastCloseDate
      ) {
        const found = stocks.find((s) => s.Symbol === k);
        if (!found) {
          continue;
        }

        const foundSector = found.sector ? found.sector : "NA";
        const returns = this.calculateDailyReturns(candles);

        if (!returns) {
          continue;
        }

        const inMap = sectorMap.get(foundSector);

        const stockWithReturn: StockSymbolWithReturn = {
          symbol: found.Symbol,
          name: found.companyName,
          sector: found.sector!,
          industry: found.industry ? found.industry : "",
          dayReturn: returns,
        };
        if (inMap) {
          inMap.push(stockWithReturn);
        } else {
          sectorMap.set(foundSector, [stockWithReturn]);
        }
      }
    }

    const sectors = Array.from(sectorMap.keys());

    const mapped: DailySectorOverview[] = sectors.flatMap((s) => {
      const symbolsWithReturns = sectorMap.get(s);
      if (!symbolsWithReturns) {
        return [];
      }

      const allReturns = symbolsWithReturns.map((swr) => swr.dayReturn);
      const returnsSum = allReturns.reduce((acc, val) => acc + val, 0);
      const meanReturn = returnsSum / allReturns.length;
      const medianReturn = calculateMedian(allReturns);

      if (!medianReturn) {
        return [];
      }

      const overview: DailySectorOverview = {
        sector: s,
        meanDayReturn: Number(meanReturn.toFixed(4)),
        medianDayReturn: Number(medianReturn.toFixed(4)),
        allReturns: allReturns.map((r) => Number(r.toFixed(4))),
      };

      return [overview]; // Return an array with the overview object inside
    });

    const dailySectorsOverview: DailySectorsOverview = {
      sectors: mapped,
    };
    return dailySectorsOverview;
  }
}
