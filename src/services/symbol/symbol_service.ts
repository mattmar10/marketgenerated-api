import { inject, injectable } from "inversify";
import * as Papa from "papaparse";
import { Readable } from "stream";
import axios from "axios";
import * as z from "zod";
import {
  FMPProfile,
  FMPSymbolProfileData,
  FMPProfileArraySchema,
} from "../financial_modeling_prep_types";
import { parse } from "dotenv";
import { Either, Left, Right, Ticker } from "../../MarketGeneratedTypes";
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
  private allSymbols: FMPSymbolProfileData[];

  private diaHoldings: EtfHoldingInfo[];
  private qqqHoldings: EtfHoldingInfo[];
  private spyHoldings: EtfHoldingInfo[];

  private stocksURL =
    "https://marketgenerated.s3.amazonaws.com/nasdaq-stocks.json";

  private etfsURL = "https://marketgenerated.s3.amazonaws.com/nasdaq-etfs.json";

  private dowURL =
    "https://marketgenerated.s3.amazonaws.com/etf-holdings/DIA.csv";
  private spyURL =
    "https://marketgenerated.s3.amazonaws.com/etf-holdings/SPY.csv";
  private qqqURL =
    "https://marketgenerated.s3.amazonaws.com/etf-holdings/QQQ.csv";

  private FINANCIAL_MODELING_PREP_URL =
    "https://financialmodelingprep.com/api/v3";
  private financialModelingPrepKey = process.env.FINANCIAL_MODELING_PREP_KEY;

  constructor() {
    this.stocks = [];
    this.etfs = [];
    this.diaHoldings = [];
    this.qqqHoldings = [];
    this.spyHoldings = [];
  }

  public getStocks(): FMPSymbolProfileData[] {
    return this.stocks;
  }

  public getEtfs(): FMPSymbolProfileData[] {
    return this.etfs;
  }

  public getDIAHoldings(): EtfHoldingInfo[] {
    return this.diaHoldings;
  }

  public getSPYHoldings(): EtfHoldingInfo[] {
    return this.spyHoldings;
  }

  public getQQQHoldings(): EtfHoldingInfo[] {
    return this.qqqHoldings;
  }

  private async fetchEtfHoldingInfo(url: string): Promise<EtfHoldingInfo[]> {
    const response = await axios.get(url);
    const csvData = await response.data;

    // Drop the header line.
    const lines = csvData.split("\n").slice(1);

    // Parse the lines into an array of EtfHoldingInfo objects.
    const etfHoldingInfos = lines.map((line: string) => {
      const [etf, ticker, name, weight] = line.split(",");

      return {
        etf,
        ticker,
        name,
        weight: parseFloat(weight),
      };
    });

    return etfHoldingInfos;
  }

  public async initialize(): Promise<void> {
    const stocksResponse = axios.get(this.stocksURL);
    const etfsResponse = axios.get(this.etfsURL);

    const profileData = SymbolService.fetchSymbolProfileData();

    try {
      const all = await Promise.all([
        stocksResponse,
        etfsResponse,
        profileData,
      ]);

      const parsedProfileData = all[2].filter(
        (pd) =>
          pd.isActivelyTrading == true && pd.VolAvg > 50000 && pd.Price > 3
      );

      console.log(`Discovered ${parsedProfileData.length} symbols`);

      this.allSymbols = parsedProfileData;
      this.stocks = parsedProfileData.filter((pd) => !pd.isEtf && !pd.isFund);

      console.log(`Discovered ${this.stocks.length} stocks`);
      this.etfs = parsedProfileData.filter((pd) => pd.isEtf);
      console.log(`Discovered ${this.etfs.length} etfs`);
    } catch (err) {
      console.error(`cannot fetch universe of symbols`, err);
      process.exit(1);
    }

    //now try to fetch etf holdings
    try {
      console.log("Fetching ETF Constituents");
      const dowHoldings = this.fetchEtfHoldingInfo(this.dowURL);
      const qqqHoldings = this.fetchEtfHoldingInfo(this.qqqURL);
      const spyHoldings = this.fetchEtfHoldingInfo(this.spyURL);

      const [dow, qqq, spy] = await Promise.all([
        dowHoldings,
        qqqHoldings,
        spyHoldings,
      ]);

      this.diaHoldings = dow;
      this.qqqHoldings = qqq;
      this.spyHoldings = spy;
      console.log("Completed fetching ETF Constituents");
    } catch (err) {
      console.error(`cannot fetch etf holdings`, err);
      process.exit(1);
    }
  }

  private static async fetchSymbolProfileData(): Promise<
    FMPSymbolProfileData[]
  > {
    const financialModelingPrepKey = process.env.FINANCIAL_MODELING_PREP_KEY;
    const url = `${FMP_BASE_URL}/v4/profile/all?apikey=${financialModelingPrepKey}`;

    try {
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
}
