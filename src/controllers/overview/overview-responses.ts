import { count } from "aws-sdk/clients/health";
import { Ticker } from "../../MarketGeneratedTypes";
import { MovingAverageError } from "../../indicators/moving-average";
import { Candle } from "../../modles/candle";
import {
  FMPProfile,
  FMPSymbolProfileData,
} from "../../services/financial_modeling_prep_types";

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
  lastCloseDate: string;
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

export interface AdvanceDeclineDataPoint {
  dateStr: string;
  cumulative: number;
  advances: number;
  declines: number;
}

export interface GlobalDailyBreadthDataPoint {
  dateStr: string;
  cumulative: number;
  globalDailyBreadth: number;
}

export interface AdvanceDeclineOverview {
  lineseries: AdvanceDeclineDataPoint[];
}

export interface MarketReturnsDataPoint {
  dateStr: string;
  mean: number;
  median: number;
}

export interface MarketReturnsLine {
  lineSeries: MarketReturnsDataPoint[];
}
export interface PercentAboveMAPoint {
  dateStr: string;
  percentAboveMA: number;
}

export interface PercentAboveSMALine {
  timeSeries: PercentAboveMAPoint[];
}

export interface UpDownDataPoint {
  dateStr: string;
  upVolume: number;
  downVolume: number;
}
export interface UpDownOverview {
  lineSeries: UpDownDataPoint[];
}

export interface FiftyTwoWeekHighsLowsDataPoint {
  dateStr: string;
  fiftyTwoWeekHighs: number;
  fiftyTwoWeekLows: number;
}
export interface FiftyTwoWeekHighsLowsOverview {
  lineSeries: FiftyTwoWeekHighsLowsDataPoint[];
}

export interface DateCount {
  dateStr: string;
  count: number;
}

export interface MarketBreadthPoint {
  dateStr: string;
  advances: number;
  declines: number;
  upVolume: number;
  downVolume: number;
  fourPercentAdvancers: number;
  fourPercentDecliners: number;
  oneMonthTwentyFivePercentAdvancers: number;
  oneMonthTwentyFivePercentDecliners: number;
  threeMonthTwentyFivePercentAdvancers: number;
  threeMonthTwentyFivePercentDecliners: number;
  fiftyTwoWeekHighs?: number;
  fiftyTwoWeekLows?: number;
  returns: number[];
}

export interface NewMarketBreadthPoint {
  totalStockCount: number;
  dateStr: string;
  advances: number;
  declines: number;
  upVolume: number;
  downVolume: number;
  fourPercentAdvancers: number;
  fourPercentDecliners: number;
  oneMonthTwentyFivePercentAdvancers: number;
  oneMonthTwentyFivePercentDecliners: number;
  threeMonthTwentyFivePercentAdvancers: number;
  threeMonthTwentyFivePercentDecliners: number;
  fiftyTwoWeekHighs?: number;
  fiftyTwoWeekLows?: number;
  meanReturn: number;
  medianReturn: number;
  percentAboveTenEMA: number;
  percentAboveTwentyOneEMA: number;
  percentAboveFiftySMA: number;
  percentAboveTwoHundredSMA: number;
  globalDailyBreadth: number;
}

export interface DailyMarketBreadthPoint {
  dateStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  profile: FMPSymbolProfileData;
  advancingOrDeclining: "advancing" | "declining" | "flat";
  volume: number;
  fiftyTwoWeekHigh: boolean;
  newFiftfiftyTwoWeekLow: boolean;
  oneDayReturn: number;
  oneWeekReturn: number;
  oneMonthReturn: number;
  threeMonthReturn: number;
  tenEMA: number | undefined;
  twentyOneEMA: number | undefined;
  fiftySMA: number | undefined;
  twoHundredSMA: number | undefined;
}

export interface MarketBreadthOverview {
  advanceDeclineLine: AdvanceDeclineDataPoint[];
  upDownVolumeLine: UpDownDataPoint[];
  fiftyTwoWeekHighsLowsLine: FiftyTwoWeekHighsLowsDataPoint[];
  mcClellanOscillator: McClellanOscillatorPoint[];
  percentAboveTwentySMA: PercentAboveMAPoint[];
  percentAboveFiftySMA: PercentAboveMAPoint[];
  percentAboveTwoHundredSMA: PercentAboveMAPoint[];
  upFourPercentLine: DateCount[];
  downFourPercentLine: DateCount[];
  oneMonthUpTwentyFivePercentyLine: DateCount[];
  oneMonthDownTwentyFivePercentyLine: DateCount[];
  threeMonthsUpTwentyFivePercentyLine: DateCount[];
  threeMonthsDownTwentyFivePercentyLine: DateCount[];
  marketReturnsLine: MarketReturnsDataPoint[];
  totalStockCount: number;
}

export interface NewMarketBreadthOverview {
  advanceDeclineLine: AdvanceDeclineDataPoint[];
  stockCountLine: DateCount[];
  upDownVolumeLine: UpDownDataPoint[];
  fiftyTwoWeekHighsLowsLine: FiftyTwoWeekHighsLowsDataPoint[];
  mcClellanOscillator: McClellanOscillatorPoint[];
  percentAboveTenEMA: PercentAboveMAPoint[];
  percentAboveTwentyOneEMA: PercentAboveMAPoint[];
  percentAboveFiftySMA: PercentAboveMAPoint[];
  percentAboveTwoHundredSMA: PercentAboveMAPoint[];
  upFourPercentLine: DateCount[];
  downFourPercentLine: DateCount[];
  oneMonthUpTwentyFivePercentyLine: DateCount[];
  oneMonthDownTwentyFivePercentyLine: DateCount[];
  threeMonthsUpTwentyFivePercentyLine: DateCount[];
  threeMonthsDownTwentyFivePercentyLine: DateCount[];
  globalDailyBreadthLine: GlobalDailyBreadthDataPoint[];
  marketReturnsLine: MarketReturnsDataPoint[];
}

export interface CurrentDayMarketBreadthSnapshotPoint {
  advanceDecline: AdvanceDeclineDataPoint;
  fiftyTwoWeekHighsLows?: FiftyTwoWeekHighsLowsDataPoint;
  upFourPercent?: number;
  downFourPercent?: number;
  returns?: MarketReturnsDataPoint;
  totalStockCount: number;
}

export interface SectorCurrentDayMarketBreadthSnapshot {
  sector: string;
  overview: CurrentDayMarketBreadthSnapshotPoint;
}
export interface CurrentDayMarketBreadthSnapshot {
  universeOverview: CurrentDayMarketBreadthSnapshotPoint;
  nyseOverview: CurrentDayMarketBreadthSnapshotPoint;
  nasdaqOverview: CurrentDayMarketBreadthSnapshotPoint;
  sectorsOverviews: SectorCurrentDayMarketBreadthSnapshot[];
}

export interface MarketBreadthResponse {
  marketBreadthOverview: NewMarketBreadthOverview;
  generalMarketOverview: GeneralMarkeOverview;
}

export interface McClellanOscillatorPoint {
  dateStr: string;
  value: number;
  cumulative: number;
}

export interface McClellanOscillator {
  lineSeries: McClellanOscillatorPoint[];
}

export interface ETFSnapshot {
  lastPrice: number;
  fiveSMA: number;
  tenEMA: number;
  twentyOneEMA: number;
  fiftySMA: number;
  twoHundredSMA: number;
}

export interface GeneralMarkeOverview {
  spySnapshot: ETFSnapshot | MovingAverageError[];
  rspSnapshot: ETFSnapshot | MovingAverageError[];
  qqqSnapshot: ETFSnapshot | MovingAverageError[];
  qqqeSnapshot: ETFSnapshot | MovingAverageError[];
  percentOfSuccesfulTenDayHighs: number;
}
