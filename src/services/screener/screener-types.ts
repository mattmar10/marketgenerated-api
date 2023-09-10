export type ScreenerResult = {
  symbol: string;
  name: string;
  isEtf: boolean;
  last: number;
  lastReturnPercent: number;
  volume: number;
  avgVolume20D: number;
  relativeVolume20D: number;
  dailyIBS: number;
  weeklyIBS: number;
  percentOf52WeekHigh: number;
  threeMonthRS: number;
  fiftyTwoWeekRSLinePercent: number;
  relativeStrengthCompositeScore: number;
  fundamentalRelativeStrengthScore: number;
  mgScore: number;
  industry?: string;
  sector?: string;
  fiftySMA: number;
  twentyEMA: number;
  tenEMA: number;
  lastDate: string;
};

export type GapUpOnVolumeScreenerResult = ScreenerResult & {
  gapUpPercent: number;
};
