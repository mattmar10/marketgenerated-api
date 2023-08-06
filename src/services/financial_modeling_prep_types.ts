import * as z from "zod";

export const FMPHistoricalSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  adjClose: z.number(),
  volume: z.number(),
  unadjustedVolume: z.number(),
  change: z.number().optional(),
  changePercent: z.number().optional(),
  //vwap: z.number().optional(),
  label: z.string().optional(),
  //changeOverTime: z.number().optional(),
});
export type FMPHistorical = z.infer<typeof FMPHistoricalSchema>;
export const FMPHistoricalArraySchema = z.array(FMPHistoricalSchema);
export type FMPHistoricalArray = z.infer<typeof FMPHistoricalArraySchema>;

export const FMPHistoricalResultSchema = z.object({
  symbol: z.string(),
  historical: z.array(FMPHistoricalSchema),
});

export type FmpHistoricalResult = z.infer<typeof FMPHistoricalResultSchema>;

export const HistoricalStockListSchema = z.object({
  symbol: z.string(),
  historical: z.array(FMPHistoricalSchema),
});

export type HistoricalStockList = z.infer<typeof HistoricalStockListSchema>;

export const FmpHistoricalListResultSchema = z.object({
  historicalStockList: z.array(HistoricalStockListSchema),
});
export type FmpHistoricalListResult = z.infer<
  typeof FmpHistoricalListResultSchema
>;

const FMPTradableSymbolSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  exchange: z.string(),
  exchangeShortName: z.string(),
  type: z.string(),
});

const FMPTradableSymbolsArraySchema = z.array(FMPTradableSymbolSchema);

export type FMPTradableSymbolArray = z.infer<
  typeof FMPTradableSymbolsArraySchema
>;

export interface FMPSymbolProfileData {
  Symbol: string;
  Price: number;
  Beta: number;
  VolAvg: number;
  MktCap: number;
  LastDiv?: number;
  Range?: string;
  Changes?: number;
  companyName: string;
  currency: string;
  cik?: string;
  isin?: string;
  cusip: string;
  exchange: string;
  exchangeShortName: string;
  industry?: string;
  website?: string;
  description?: string;
  CEO?: string;
  sector?: string;
  country?: string;
  fullTimeEmployees?: number;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  DCF_diff?: string;
  DCF?: string;
  image?: string;
  ipoDate?: string;
  defaultImage?: string;
  isEtf: boolean;
  isActivelyTrading: boolean;
  isFund: boolean;
  isAdr: boolean;
}

export const FmpProfileSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  beta: z.number(),
  volAvg: z.number(),
  mktCap: z.number(),
  lastDiv: z.number(),
  range: z.string(),
  changes: z.number(),
  companyName: z.string(),
  currency: z.string(),
  cik: z.string(),
  isin: z.string(),
  cusip: z.string(),
  exchange: z.string(),
  exchangeShortName: z.string(),
  industry: z.string(),
  website: z.string(),
  description: z.string(),
  ceo: z.string(),
  sector: z.string(),
  country: z.string(),
  fullTimeEmployees: z.string(),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  dcfDiff: z.number(),
  dcf: z.number(),
  image: z.string(),
  ipoDate: z.string(),
  defaultImage: z.boolean(),
  isEtf: z.boolean(),
  isActivelyTrading: z.boolean(),
  isAdr: z.boolean(),
  isFund: z.boolean(),
});
export type FMPProfile = z.infer<typeof FmpProfileSchema>;
export const FMPProfileArraySchema = FmpProfileSchema.array();
export type FMPProfileList = z.infer<typeof FMPProfileArraySchema>;
