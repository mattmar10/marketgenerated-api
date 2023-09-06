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
  rsRating: number;
  threeMonthRS: number;
  fiftyTwoWeekRSLinePercent: number;
  industry?: string;
  sector?: string;
};

export type GapUpOnVolumeScreenerResult = ScreenerResult & {
  gapUpPercent: number;
};
