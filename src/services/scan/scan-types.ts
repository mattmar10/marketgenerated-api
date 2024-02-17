import { Ticker } from "../../MarketGeneratedTypes";
import {
  RelativeStrengthLineStats,
  RelativeStrengthsFromSlopeAggregate,
} from "../relative-strength/relative-strength-types";

export interface ScanResults {
  scanName: string;
  completionTime: string;
  results: StocksAndEtfs;
}

export interface StocksAndEtfs {
  stocks: Ticker[];
  etfs: Ticker[];
}

export function isScanResults(object: any): object is ScanResults {
  return (
    typeof object === "object" &&
    object !== null &&
    "scanName" in object &&
    typeof object.scanName === "string" &&
    "completionTime" in object &&
    typeof object.completionTime === "string" &&
    "results" in object &&
    typeof object.results === "object" &&
    "stocks" in object.results &&
    Array.isArray(object.results.stocks) &&
    "etfs" in object.results &&
    Array.isArray(object.results.etfs)
  );
}

export type ScanResponseRow = {
  ticker: Ticker;
  name: string;
  price: number;
  adrP: number;
  percentChange: number;
  marketCap: number;
  volume: number;
  rVolume: number;
  sector?: string;
  industry?: string;
  rsRankFromSlope: RelativeStrengthsFromSlopeAggregate | undefined;
  compositeRelativeStrengthRank: number;
  //eps
  //pe
};

export type ScanIdentifier = string;

export type ScanResultsWithRows = {
  scanId: ScanIdentifier;
  completionTime: string;
  scanName: string;
  description: string;
  etfs: ScanResponseRow[];
  stocks: ScanResponseRow[];
};

export interface ScanMatchResponse {
  ticker: Ticker;
  date: Date;
  scanName: string;
  scanId: string;
}
