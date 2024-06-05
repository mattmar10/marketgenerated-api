import { inject, injectable } from "inversify";
import TYPES from "../types";
import { SymbolService } from "./symbol/symbol_service";
import { DailyCacheService } from "./daily_cache_service";
import { Ticker, match } from "../MarketGeneratedTypes";
import { Quote } from "./symbol/symbol-types";
import { Candle } from "../modles/candle";

@injectable()
export class RealtimeQuoteService {
  private realtimeQuotes: Map<Ticker, Quote> = new Map();

  private tickerBuckets: Ticker[][];
  private bucketIndex: number;

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService
  ) {
    this.tickerBuckets = [];
    this.bucketIndex = 0;
  }

  public getLatestQuote(ticker: Ticker): Quote | undefined {
    return this.realtimeQuotes.get(ticker);
  }

  public getAllLatestQuotes(): Map<Ticker, Quote> {
    return this.realtimeQuotes;
  }

  public initialize(): void {
    const currentDate = new Date();

    const twoYearsOneDayAgo = new Date(
      currentDate.getFullYear() - 2,
      currentDate.getMonth(),
      currentDate.getDate() - 1,
      currentDate.getHours(),
      currentDate.getMinutes(),
      currentDate.getSeconds(),
      currentDate.getMilliseconds()
    );

    // Get the time in milliseconds
    const startMillis = twoYearsOneDayAgo.getTime();
    const endMillis = currentDate.getTime();

    const stocks = this.symbolSvc.getStocks().map((s) => s.Symbol);

    const filteredStocks = [];

    stocks.forEach((s) => {
      const candles: Candle[] = this.cacheSvc.getCandles(s);
      const filteredCandles = candles.filter(
        (c) => c.date >= startMillis && c.date <= endMillis
      );

      if (filteredCandles.length > 252) {
        filteredStocks.push(s);
      }
    });

    const numArrays = filteredStocks.length / 250;
    const chunkSize = Math.ceil(filteredStocks.length / numArrays);

    for (let i = 0; i < filteredStocks.length; i += chunkSize) {
      const chunk = stocks.slice(i, i + chunkSize);
      this.tickerBuckets.push(chunk);
    }

    // Set up refresh method to fire every 10 seconds
    setInterval(this.refresh, 20000);
    console.log(
      `Initialized Realtime quote service for ${filteredStocks.length} stocks`
    );
  }

  private refresh = async () => {
    // Implement your refresh logic here
    // This method will be called every 15 seconds
    const tickers = this.tickerBuckets[this.bucketIndex];

    console.log(`Fetching quotes for ${tickers.length} symbols`);
    const quotes = await this.symbolSvc.getQuotesForSymbols(tickers);

    match(
      quotes,
      (error) => console.error(error),
      (data) => {
        data.forEach((d) => {
          this.realtimeQuotes.set(d.symbol, d);
        });
      }
    );

    if (this.bucketIndex === this.tickerBuckets.length - 1) {
      this.bucketIndex = 0;
    } else {
      this.bucketIndex = this.bucketIndex + 1;
    }
  };
}
