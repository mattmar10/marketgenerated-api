import { Ticker } from "../../MarketGeneratedTypes";

export type RelativeStrengthError = string;

export interface ReturnData {
  symbol: Ticker;
  name: string;
  oneYearReturns: number;
  yearToDateReturns: number;
  sixMonthReturns: number;
  nineMonthReturns: number;
  fiveMonthReturns: number;
  threeMonthReturns: number;
  oneMonthReturns: number;
  twoWeekReturns: number;
  oneWeekReturns: number;
  oneDayReturns: number;
}

export interface RelativeStrength {
  symbol: string;
  name: string;
  relativeStrength: number;
  returns: number;
  timePeriod: RelativeStrengthTimePeriod;
}

export const RelativeStrengthTimePeriodTypes = [
  "1Y",
  "YTD",
  "9M",
  "6M",
  "5M",
  "3M",
  "1M",
  "2W",
  "1W",
  "1D",
] as const;

export type RelativeStrengthTimePeriod =
  (typeof RelativeStrengthTimePeriodTypes)[number];

export interface RelativeStrengthsForSymbol {
  symbol: string;
  relativeStrengths: RelativeStrength[];
  relativeStrengthLine: RelativeStrengthLine;
  compositeScore: number;
}

export interface RelativeStrengthLineStats {
  fiftyDaySlope: number;
  percentOfFiftyTwoWeekRange: number;
}

export interface RelativeStrengthsForSymbolStats {
  symbol: string;
  relativeStrengths: RelativeStrength[];
  relativeStrengthLineStats: RelativeStrengthLineStats;
  compositeScore: number;
}

export interface RelativeStrengthPerformers {
  stocks: RelativeStrengthsForSymbolStats[];
  etfs: RelativeStrengthsForSymbolStats[];
}
export interface RelativeStrengthLinePoint {
  date: string;
  value: number;
}
export interface RelativeStrengthLine {
  data: RelativeStrengthLinePoint[];
}

export interface CompositeRelativeStrengthPerformers {
  stocks: RelativeStrengthsForSymbol[];
  etfs: RelativeStrengthsForSymbol[];
}

export interface RelativeStrengthPerformersForPeriod {
  stocks: RelativeStrength[];
  etfs: RelativeStrength[];
}

export function isRelativeStrengthTimePeriod(
  value: string
): value is RelativeStrengthTimePeriod {
  return RelativeStrengthTimePeriodTypes.includes(
    value as RelativeStrengthTimePeriod
  );
}

export function isRelativeStrengthsForSymbol(
  data: RelativeStrengthsForSymbol | RelativeStrengthError
): data is RelativeStrengthsForSymbol {
  return typeof data !== "string";
}

export function isRelativeStrengthError(
  data: RelativeStrengthsForSymbolStats | RelativeStrengthError
): data is RelativeStrengthError {
  return typeof data === "string";
}
