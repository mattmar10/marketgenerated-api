import { Ticker } from "../../MarketGeneratedTypes";

export type ScreenerResult = {
  symbol: Ticker;
  name: string;
  isEtf: boolean;
  industry?: string;
  last: number;
  lastReturnPercent: number;
  volume: number;
  avgVolume20D: number;
  relativeVolume20D: number;
  dailyIBS: number;
  weeklyIBS: number;
  percentOf52WeekHigh: number;
  threeMonthRS: number;
  rsRating: number;
  fiftyTwoWeekRSLinePercent: number;
};

export type GapUpOnVolumeScreenerResult = ScreenerResult & {
  gapUpPercent: number;
};
