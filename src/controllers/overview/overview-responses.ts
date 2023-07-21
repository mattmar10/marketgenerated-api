import { Ticker } from "../../MarketGeneratedTypes";
import { Candle } from "../../modles/candle";

export interface ETFHoldingPriceReturn {
  symbol: Ticker;
  dayReturn: number;
  volume: number;
  closeDate: number;
}

export interface ETFDailyOverview {
  symbol: Ticker;
  lastCandle: Candle;
  lastReturn: number;
  lastChange: number;
  holdingReturns: ETFHoldingPriceReturn[];
}

export interface ETFOverviewPriceReturns {
  returns: ETFDailyOverview[];
  lastCloseDate: number;
}

export interface DailyMover {
  symbol: Ticker;
  name: string;
  volume: number;
  avgVolume: number;
  change: number;
  percentChange: number;
  lastClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  lastCloseDate: number;
}

export interface DailyMovers {
  gainers: DailyMover[];
  losers: DailyMover[];
  actives: DailyMover[];
}

export interface DailyActivesAndMovers {
  gainers: DailyMover[];
  losers: DailyMover[];
  actives: DailyMover[];
}

export interface MarketDailyMovers {
  stockMovers: DailyActivesAndMovers;
  etfMovers: DailyActivesAndMovers;
}
