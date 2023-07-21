import { inject, injectable } from "inversify";
import TYPES from "../types";
import { Ticker } from "../MarketGeneratedTypes";
import axios from "axios";
import * as z from "zod";

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
  private stocks: StockSymbol[];
  private etfs: EtfSymbol[];
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

  constructor() {}

  public getStocks(): StockSymbol[] {
    return this.stocks;
  }

  public getEtfs(): EtfSymbol[] {
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

    try {
      const all = await Promise.all([stocksResponse, etfsResponse]);

      const stocksJson = all[0].data;
      const stocks: StockSymbol[] =
        nasdaqStockSymbolsSchema.parse(stocksJson).data.rows;
      this.stocks = stocks;

      const etfsJson = all[1].data;
      const etfs: EtfSymbol[] =
        nasdaqEtfSymbolsSchema.parse(etfsJson).data.data.rows;
      this.etfs = etfs;
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
}
