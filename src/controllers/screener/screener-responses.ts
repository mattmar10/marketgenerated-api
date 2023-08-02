import { Ticker } from "../../MarketGeneratedTypes";

export interface TrendTemplateResult {
  symbol: Ticker;
  lastClose: number;
  twoHundredMA: number;
  oneFiftyMA: number;
  fiftyMA: number;
  twoHudredMALRSlope: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  compositeRelativeStrength: number;
  percentFrom50MA: number;
}

export interface TrendTemplateResults {
  results: TrendTemplateResult[];
}
