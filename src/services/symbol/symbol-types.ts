import * as z from "zod";

export const QuoteElementSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  changesPercentage: z.number(),
  change: z.number(),
  dayLow: z.number(),
  dayHigh: z.number(),
  yearHigh: z.number(),
  yearLow: z.number(),
  marketCap: z.number(),
  priceAvg50: z.number(),
  priceAvg200: z.number(),
  exchange: z.string(),
  volume: z.number(),
  avgVolume: z.number(),
  open: z.number(),
  previousClose: z.number(),
  eps: z.number(),
  pe: z.number(),
  earningsAnnouncement: z.string().nullable(),
  sharesOutstanding: z.number().nullable(),
  timestamp: z.number(),
});

export type Quote = z.infer<typeof QuoteElementSchema>;

export const QuoteArraySchema = QuoteElementSchema.array();

export interface SymbolProfile {
  symbol: string;
  mktCap: number;
  currency: string;
  companyName: string;
  industry?: string;
  sector?: string;
  website?: string;
  description?: string;
}
