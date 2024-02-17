import { Ticker } from "../../MarketGeneratedTypes";

export interface PredefinedScanInfo {
  name: string;
  description: string;
  s3Identifier: string;
  advanced: boolean;
  active: boolean;
}

export interface ScanResult {
  ticker: Ticker;
  date: Date;
  scanName: string;
  scanId: string;
}
