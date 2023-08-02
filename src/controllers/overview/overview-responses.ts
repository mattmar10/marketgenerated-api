import { Ticker } from "../../MarketGeneratedTypes";
import { Candle } from "../../modles/candle";

export interface ConstituentPriceReturn {
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
  holdingReturns: ConstituentPriceReturn[];
}

export interface IndexDailyOverview {
  symbol: Ticker;
  lastCandle: Candle;
  lastReturn: number;
  lastChange: number;
  holdingReturns: ConstituentPriceReturn[];
}

export interface IndexDailyOverviewPriceReturns {
  returns: IndexDailyOverview[];
  lastCloseDate: number;
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

export interface DailySectorOverview {
  sector: string;
  meanDayReturn: number;
  medianDayReturn: number;
  allReturns: number[];
}

export interface DailySectorsOverview {
  sectors: DailySectorOverview[];
}
