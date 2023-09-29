import { Ticker } from "../../MarketGeneratedTypes";

export interface TrendTemplateResultOld {
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
  relativeStrengthPercentOfFiftyTwoWeekRange: number;
}

export interface TrendTemplateResultsOld {
  lastDate: string;
  stocks: TrendTemplateResultOld[];
  etfs: TrendTemplateResultOld[];
}
