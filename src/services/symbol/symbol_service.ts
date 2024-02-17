import { inject, injectable } from "inversify";
import * as Papa from "papaparse";
import { Readable } from "stream";
import axios from "axios";
import * as z from "zod";
import {
  FMPProfile,
  FMPSymbolProfileData,
  FMPProfileArraySchema,
  CandleListSchema,
  CandlesList,
} from "../financial_modeling_prep_types";

import { Either, Left, Right, Ticker } from "../../MarketGeneratedTypes";
import {
  FmpIncomeStatementList,
  FmpIncomeStatementListSchema,
  FmpNewsList,
  FmpNewsListSchema,
  PeriodType,
  Quote,
  QuoteArraySchema,
  SymbolFundamentalChangeStats,
  SymbolFundamentalChangesStats,
  SymbolFundamentalStats,
  SymbolFundamentalsStats,
} from "./symbol-types";
export type SymbolServiceError = string;

const FMP_BASE_URL = "https://financialmodelingprep.com/api";

const etfSymbolSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
});

const stockSymbolSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  sector: z.string(),
  industry: z.string(),
});

const nasdaqStockSymbolDataSchema = z.object({
  headers: z.record(z.string()), // Map with string keys and string values
  rows: z.array(stockSymbolSchema),
  extras: z.any(), // Array of NasdaqStockSymbol objects
});

const nasdaqStockSymbolsSchema = z.object({
  data: nasdaqStockSymbolDataSchema,
});

const nasdaqEtfSymbolDataSchema = z.object({
  rows: z.array(etfSymbolSchema),
  extras: z.any(), // Array of NasdaqStockSymbol objects
});

const nasdaqEtfDataSymbolDataSchema = z.object({
  data: nasdaqEtfSymbolDataSchema,
});

const nasdaqEtfSymbolsSchema = z.object({
  data: nasdaqEtfDataSymbolDataSchema,
});

export type StockSymbol = z.infer<typeof stockSymbolSchema>;
export type EtfSymbol = z.infer<typeof etfSymbolSchema>;

export interface EtfHoldingInfo {
  etf: string;
  ticker: string;
  name: string;
  weight: number;
}

@injectable()
export class SymbolService {
  private stocks: FMPSymbolProfileData[];
  private etfs: FMPSymbolProfileData[];

  private FINANCIAL_MODELING_PREP_URL =
    "https://financialmodelingprep.com/api/v3";
  private financialModelingPrepKey = process.env.FINANCIAL_MODELING_PREP_KEY;

  constructor() {
    this.stocks = [];
    this.etfs = [];
  }

  public getStocks(): FMPSymbolProfileData[] {
    return this.stocks;
  }

  public getEtfs(): FMPSymbolProfileData[] {
    return this.etfs;
  }

  public async initialize(): Promise<void> {
    try {
      const profileData = await SymbolService.fetchSymbolProfileData();

      const parsedProfileData = profileData.filter(
        (pd) => pd.VolAvg > 50000 && pd.Price > 5
      );

      console.log(`Discovered ${parsedProfileData.length} symbols`);

      this.stocks = parsedProfileData.filter((pd) => !pd.isEtf && !pd.isFund);

      console.log(`Discovered ${this.stocks.length} stocks`);
      this.etfs = parsedProfileData.filter((pd) => pd.isEtf);
      console.log(`Discovered ${this.etfs.length} etfs`);
    } catch (err) {
      console.error(`cannot fetch universe of symbols`, err);
      process.exit(1);
    }
  }

  private static async fetchSymbolProfileData(): Promise<
    FMPSymbolProfileData[]
  > {
    const financialModelingPrepKey = process.env.FINANCIAL_MODELING_PREP_KEY;
    const url = `${FMP_BASE_URL}/v4/profile/all?apikey=${financialModelingPrepKey}`;

    try {
      console.log("Fetching all profiles from FMP");
      const response = await axios.get(url);

      // The CSV data will be available in response.data
      const csvData: string = response.data;

      // Parse the CSV data using papaparse with dynamicTyping option
      const parsedData: Papa.ParseResult<FMPSymbolProfileData> =
        Papa.parse<FMPSymbolProfileData>(csvData, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          transformHeader: (header) => header.trim(),
        });

      if (parsedData.errors && parsedData.errors.length > 0) {
        throw new Error(`Error parsing CSV: ${parsedData.errors[0].message}`);
      }

      // The parsed data will be available in parsedData.data
      return parsedData.data;
    } catch (error) {
      // Handle errors
      console.error("Error fetching or parsing CSV:", error);
      throw error;
    }
  }

  public async getQuoteForSymbol(
    symbol: Ticker
  ): Promise<Either<SymbolServiceError, Quote>> {
    console.log(`fetching quote for ${symbol}`);
    const url = `${this.FINANCIAL_MODELING_PREP_URL}/quote/${symbol}?apikey=${this.financialModelingPrepKey}`;

    try {
      const response = await axios.get(url);
      const parsed = QuoteArraySchema.safeParse(response.data);

      if (parsed.success) {
        return Right<Quote>(parsed.data[0]);
      } else {
        return Left<SymbolServiceError>(
          `Error parsing profile data for ${symbol}`
        );
      }
    } catch (error) {
      console.error(error);
      return Promise.resolve(
        Left<SymbolServiceError>(`Unable to get quote for symbol ${symbol}`)
      );
    }
  }

  public async getWeeklyCandlesForSymbol(
    symbol: Ticker,
    startDate: string | undefined,
    endDate: string | undefined
  ): Promise<Either<SymbolServiceError, CandlesList>> {
    console.log(`fetching weekly candles for ${symbol}`);
    let url = `${this.FINANCIAL_MODELING_PREP_URL}/historical-chart/1week/${symbol}?apikey=${this.financialModelingPrepKey}`;

    if (startDate && endDate) {
      url += `&from=${startDate}&to=${endDate}`;
    } else if (startDate) {
      url += `&from=${startDate}`;
    } else if (endDate) {
      url += `&to=${endDate}`;
    }

    try {
      const response = await axios.get(url);
      const parsed = CandleListSchema.safeParse(response.data);

      if (parsed.success) {
        return Right<CandlesList>(parsed.data);
      } else {
        return Left<SymbolServiceError>(
          `Error parsing weekly candles data for ${symbol}`
        );
      }
    } catch (error) {
      console.error(error);
      return Promise.resolve(
        Left<SymbolServiceError>(
          `Unable to get weekly candles for symbol ${symbol}`
        )
      );
    }
  }

  public async getDailyCandlesForSymbol(
    symbol: Ticker
  ): Promise<Either<SymbolServiceError, CandlesList>> {
    console.log(`fetching daily candles for ${symbol}`);
    const url = `${this.FINANCIAL_MODELING_PREP_URL}/historical-chart/1day/${symbol}?apikey=${this.financialModelingPrepKey}`;

    try {
      const response = await axios.get(url);
      const parsed = CandleListSchema.safeParse(response.data);

      if (parsed.success) {
        return Right<CandlesList>(parsed.data);
      } else {
        return Left<SymbolServiceError>(
          `Error parsing daily candles data for ${symbol}`
        );
      }
    } catch (error) {
      console.error(error);
      return Promise.resolve(
        Left<SymbolServiceError>(
          `Unable to get daily candles for symbol ${symbol}`
        )
      );
    }
  }

  public async getProfileForSymbol(
    symbol: Ticker
  ): Promise<Either<SymbolServiceError, FMPProfile>> {
    try {
      console.log(`fetching profile for ${symbol}`);
      const url = `${this.FINANCIAL_MODELING_PREP_URL}/profile/${symbol}?apikey=${this.financialModelingPrepKey}`;

      const response = await axios.get(url);
      const data = response.data;

      const parsed = FMPProfileArraySchema.safeParse(data);

      if (parsed.success) {
        return Right<FMPProfile>(parsed.data[0] as FMPProfile);
      } else {
        return Left<SymbolServiceError>(
          `Error parsing profile data for ${symbol}`
        );
      }
    } catch (error) {
      console.error(error);
      return Promise.resolve(
        Left<SymbolServiceError>(`Unable to get profile for symbol ${symbol}`)
      );
    }
  }

  public async getNewsForSymbol(
    symbol: Ticker
  ): Promise<Either<SymbolServiceError, FmpNewsList>> {
    try {
      console.log(`fetching profile for ${symbol}`);
      const url = `${this.FINANCIAL_MODELING_PREP_URL}/stock_news?tickers=${symbol}&limit=50&apikey=${this.financialModelingPrepKey}`;

      const response = await axios.get(url);
      const data = response.data;

      const parsed = FmpNewsListSchema.safeParse(data);

      if (parsed.success) {
        return Right<FmpNewsList>(parsed.data);
      } else {
        return Left<SymbolServiceError>(
          `Error parsing news data for ${symbol}`
        );
      }
    } catch (error) {
      console.error(error);
      return Promise.resolve(
        Left<SymbolServiceError>(`Unable to get profile for symbol ${symbol}`)
      );
    }
  }

  public async getIncomeStatementForSymbol(
    symbol: Ticker,
    period: PeriodType = "quarter",
    limit: number = 4
  ): Promise<Either<SymbolServiceError, FmpIncomeStatementList>> {
    try {
      console.log(`fetching income staterment for ${symbol}`);
      const url = `${this.FINANCIAL_MODELING_PREP_URL}/income-statement/${symbol}?period=${period}&limit=${limit}&apikey=${this.financialModelingPrepKey}`;

      const response = await axios.get(url);
      const data = response.data;

      const parsed = FmpIncomeStatementListSchema.safeParse(data);

      if (parsed.success) {
        return Right<FmpIncomeStatementList>(parsed.data);
      } else {
        return Left<SymbolServiceError>(
          `Error parsing incompe statement data for ${symbol}`
        );
      }
    } catch (error) {
      console.error(error);
      return Promise.resolve(
        Left<SymbolServiceError>(
          `Unable to get income statement data for symbol ${symbol}`
        )
      );
    }
  }

  public async getFundamentalStatsForSymbol(
    symbol: Ticker,
    period: PeriodType = "quarter",
    limit: number = 4
  ): Promise<Either<SymbolServiceError, SymbolFundamentalsStats>> {
    try {
      console.log(`fetching fundamental quarter stats for ${symbol}`);
      const url = `${
        this.FINANCIAL_MODELING_PREP_URL
      }/income-statement/${symbol}?period=${period}&limit=${limit + 1}&apikey=${
        this.financialModelingPrepKey
      }`;

      const response = await axios.get(url);
      const data = response.data;

      const parsed = FmpIncomeStatementListSchema.safeParse(data);

      if (parsed.success) {
        const incomes = parsed.data.reverse();
        const result: SymbolFundamentalStats[] = [];

        for (let i = 1; i < incomes.length; i++) {
          const current = incomes[i];

          result.push({
            date: current.date,
            revenue: current.revenue,
            profit: current.grossProfit,
            eps: current.eps,
          });
        }

        const stats: SymbolFundamentalsStats = {
          symbol: symbol,
          stats: result,
        };

        return Right(stats);
      } else {
        return Left<SymbolServiceError>(
          `Error parsing incompe statement data for ${symbol}`
        );
      }
    } catch (error) {
      console.error(error);
      return Promise.resolve(
        Left<SymbolServiceError>(
          `Unable to get fundamental stats for symbol ${symbol}`
        )
      );
    }
  }

  public async getFundamentalChangeStatsForSymbol(
    symbol: Ticker,
    period: PeriodType = "quarter",
    limit: number = 4
  ): Promise<Either<SymbolServiceError, SymbolFundamentalChangesStats>> {
    try {
      console.log(`fetching fundamental quarter stats for ${symbol}`);
      const url = `${
        this.FINANCIAL_MODELING_PREP_URL
      }/income-statement/${symbol}?period=${period}&limit=${limit + 1}&apikey=${
        this.financialModelingPrepKey
      }`;

      const response = await axios.get(url);
      const data = response.data;

      const parsed = FmpIncomeStatementListSchema.safeParse(data);

      if (parsed.success) {
        const incomes = parsed.data.reverse();
        const result: SymbolFundamentalChangeStats[] = [];

        for (let i = 1; i < incomes.length; i++) {
          const current = incomes[i];
          const previous = incomes[i - 1];

          const profitChangePercent = Number(
            this.calculatePercentageChange(
              current.grossProfit,
              previous.grossProfit
            ).toFixed(2)
          );
          const epsChangePercent = Number(
            this.calculatePercentageChange(current.eps, previous.eps).toFixed(2)
          );
          const revenueChangePercent = Number(
            this.calculatePercentageChange(
              current.revenue,
              previous.revenue
            ).toFixed(2)
          );
          const incomeChangePercent = Number(
            this.calculatePercentageChange(
              current.netIncome,
              previous.netIncome
            ).toFixed(2)
          );

          result.push({
            date: current.date,
            profitChangePercent,
            epsChangePercent,
            revenueChangePercent,
            incomeChangePercent,
          });
        }

        const stats: SymbolFundamentalChangesStats = {
          symbol: symbol,
          stats: result,
        };

        return Right(stats);
      } else {
        return Left<SymbolServiceError>(
          `Error parsing incompe statement data for ${symbol}`
        );
      }
    } catch (error) {
      console.error(error);
      return Promise.resolve(
        Left<SymbolServiceError>(
          `Unable to get fundamental stats for symbol ${symbol}`
        )
      );
    }
  }

  private calculatePercentageChange(
    currentValue: number,
    previousValue: number
  ): number {
    if (previousValue === 0) {
      return 0; // Handle division by zero case
    }
    return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  }
}
