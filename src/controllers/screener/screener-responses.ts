import { Ticker } from "../../MarketGeneratedTypes";

export interface TrendTemplateResult {
  symbol: Ticker;
  name: string;
  lastClose: number;
  lastVolume: number;
  lastDailyRange: number;
  twoHundredMA: number;
  oneFiftyMA: number;
  fiftyMA: number;
  twoHudredMALRSlope: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  compositeRelativeStrength: number;
  percentFrom50MA: number;
  lastTwentyAvgVolume: number;
  lastTwentyVolumeLinearRegressionSlope: number;
  lastTwentyAvgDailyRange: number;
  lastTwentDailyRangeLinearRegressionSlope: number;
}

export interface TrendTemplateResults {
  lastDate: string;
  stocks: TrendTemplateResult[];
  etfs: TrendTemplateResult[];
}
