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
  isEtf: boolean;
}

export const FmpNewsSchema = z.object({
  symbol: z.string(),
  publishedDate: z.coerce.date(),
  title: z.string(),
  image: z.string(),
  site: z.string(),
  text: z.string(),
  url: z.string(),
});
export const FmpNewsListSchema = FmpNewsSchema.array();
export type FmpNewsList = z.infer<typeof FmpNewsListSchema>;
export type FmpNews = z.infer<typeof FmpNewsSchema>;

export interface SymbolFundamentalChangeStats {
  date: string;
  profitChangePercent: number;
  epsChangePercent: number;
  revenueChangePercent: number;
  incomeChangePercent: number;
}

export interface SymbolFundamentalChangesStats {
  symbol: string;
  stats: SymbolFundamentalChangeStats[];
}

export const FmpIncomeStatementElementSchema = z.object({
  date: z.string(),
  symbol: z.string(),
  reportedCurrency: z.string(),
  cik: z.string(),
  fillingDate: z.string(),
  acceptedDate: z.coerce.date(),
  calendarYear: z.string(),
  period: z.string(),
  revenue: z.number(),
  costOfRevenue: z.number(),
  grossProfit: z.number(),
  grossProfitRatio: z.number(),
  researchAndDevelopmentExpenses: z.number().nullable(),
  generalAndAdministrativeExpenses: z.number().nullable(),
  sellingAndMarketingExpenses: z.number().nullable(),
  sellingGeneralAndAdministrativeExpenses: z.number().nullable(),
  otherExpenses: z.number().nullable(),
  operatingExpenses: z.number().nullable(),
  costAndExpenses: z.number().nullable(),
  interestIncome: z.number().nullable(),
  interestExpense: z.number().nullable(),
  depreciationAndAmortization: z.number().nullable(),
  ebitda: z.number().nullable(),
  ebitdaratio: z.number().nullable(),
  operatingIncome: z.number().nullable(),
  operatingIncomeRatio: z.number().nullable(),
  totalOtherIncomeExpensesNet: z.number().nullable(),
  incomeBeforeTax: z.number(),
  incomeBeforeTaxRatio: z.number(),
  incomeTaxExpense: z.number(),
  netIncome: z.number(),
  netIncomeRatio: z.number(),
  eps: z.number(),
  epsdiluted: z.number(),
  weightedAverageShsOut: z.number().nullable(),
  weightedAverageShsOutDil: z.number().nullable(),
  link: z.string().nullable(),
  finalLink: z.string().nullable(),
});

export const FmpIncomeStatementListSchema =
  FmpIncomeStatementElementSchema.array();
export type FmpIncomeStatementList = z.infer<
  typeof FmpIncomeStatementListSchema
>;
export type FmpIncomeStatementElement = z.infer<
  typeof FmpIncomeStatementElementSchema
>;

export type PeriodType = "quarter" | "annual";
