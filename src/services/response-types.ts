import { Ticker } from "../MarketGeneratedTypes";
import { Candle } from "../modles/candle";
import { RelativeStrengthsFromSlopeAggregate } from "./relative-strength/relative-strength-types";

export type TableResponseRow = {
  ticker: Ticker;
  name: string;
  exchange: string;
  last: Candle;
  adrP: number;
  percentChange: number;
  marketCap: number;
  volume: number;
  rVolume: number;
  sector?: string;
  industry?: string;
  rsRankFromSlope: RelativeStrengthsFromSlopeAggregate | undefined;
  compositeRelativeStrengthRank: number;
  tenEMA: number | undefined;
  twentyOneEMA: number | undefined;
  fiftySMA: number | undefined;
  twoHundredSMA: number | undefined;
  isInsideBar: boolean;
  atEarningsAVWap: boolean;
  //eps
  //pe
};
