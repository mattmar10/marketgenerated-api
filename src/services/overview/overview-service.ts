import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { EtfHoldingInfo, SymbolService } from "../symbol_service";
import { DailyCacheService } from "../daily_cache_service";
import { Candle } from "../../modles/candle";
import {
  ETFDailyOverview,
  ETFHoldingPriceReturn,
  ETFOverviewPriceReturns,
  DailyMover,
  MarketDailyMovers,
  DailyActivesAndMovers,
} from "../../controllers/overview/overview-responses";
import { Ticker } from "../../MarketGeneratedTypes";

@injectable()
export class OverviewService {
  private dailyStockMovers: DailyMover[];
  private dailyETFMovers: DailyMover[];

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService
  ) {
    this.buildMovers();
  }

  private buildMovers() {
    const etfs = this.symbolSvc.getEtfs();
    const stocks = this.symbolSvc.getStocks();
    const cached = this.cacheSvc.getAllData();

    const universeOfStockKeys = stocks.map((s) => s.symbol);
    const universeOfEtfKeys = etfs.map((e) => e.symbol);

    const allKeys = cached.keys();
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
        const name = stocks.find((s) => s.symbol === k).name;
        const candles = this.cacheSvc.getCandles(k);
        const filtered = this.filterCandlesPast52Weeks(candles);

        if (!filtered || filtered.length < 20 || !name) {
          continue;
        }
        const mover: DailyMover = buildMoverRow(k, name, filtered);
        stockMovers.push(mover);
      } else if (universeOfEtfKeys.includes(k)) {
        const name = etfs.find((s) => s.symbol === k).companyName;
        const candles = this.cacheSvc.getCandles(k);
        const filtered = this.filterCandlesPast52Weeks(candles);

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
    const sorted = candles.sort((c: Candle) => c.date);
    const [head, tail] = sorted.slice(-2);
    const lastChange = tail.close - head.close;

    const allReturns = etfHoldings.flatMap((eHolding) => {
      const candles = this.cacheSvc.getCandles(eHolding.ticker);
      const dailyReturn = this.calculateDailyReturns(candles);

      if (dailyReturn === undefined) {
        return [];
      }

      const lastCandle: Candle = candles[candles.length - 1];

      const etfReturn: ETFHoldingPriceReturn = {
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
      lastReturn: Number(returns.toFixed(4)),
      lastChange: Number(lastChange.toFixed(4)),
      holdingReturns: allReturns,
    };
    return overview;
  }

  private calculateDailyReturns(candles: Candle[]): number | undefined {
    if (!candles || candles.length < 2) {
      return undefined;
    }
    const sorted = candles.sort((c) => c.date);
    const [head, tail] = sorted.slice(-2);

    return (tail.close - head.close) / head.close;
  }

  private filterCandlesPast52Weeks = (candles: Candle[]): Candle[] => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const oneYearAgo = now.getTime() - 52 * 7 * 24 * 60 * 60 * 1000;

    const sorted = candles.sort((a, b) => a.date - b.date);
    return sorted.filter((candle) => {
      return candle.date >= oneYearAgo && candle.date <= now.getTime();
    });
  };

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
}
