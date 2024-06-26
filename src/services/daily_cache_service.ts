import { inject, injectable } from "inversify";
import { Candle, isCandle } from "../modles/candle";
import { Ticker } from "../MarketGeneratedTypes";
import { promises as fs } from "fs";
import * as zlib from "zlib";

import TYPES from "../types";

import {
  ListObjectsV2Command,
  GetObjectCommand,
  S3Client,
  _Object,
} from "@aws-sdk/client-s3";

import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { DataError, isDataError } from "./data_error";
import { zodTiingoCandlesSchema } from "./tiingo_types";

import {
  addOneDay,
  dateSringToMillisSinceEpochInET,
  formatDateFromMillisecondsToEST,
  formatDateToEST,
} from "../utils/epoch_utils";
import axios from "axios";
import { parseBooleanEnv } from "../utils/env_var_utils";
import {
  FMPEarningsCalendar,
  FMPEarningsCalendarSchema,
  FMPHistoricalArraySchema,
  FMPHistoricalResultSchema,
  isFMPEarningsCalendar,
} from "./financial_modeling_prep_types";
import Bottleneck from "bottleneck";
import { symbol } from "zod";
import { ema, isMovingAverageError, sma } from "../indicators/moving-average";

interface CacheEntry {
  symbol: Ticker;
  candles: Candle[];
}
function isCacheEntry(entry: any): entry is CacheEntry {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "symbol" in entry &&
    "candles" in entry &&
    Array.isArray(entry.candles)
  );
}

@injectable()
export class DailyCacheService {
  private TIINGO_URL = "https://api.tiingo.com/tiingo";
  private tiingoKey = process.env.TIINGO_KEY;
  private FINANCIAL_MODELING_PREP_URL = "https://financialmodelingprep.com/api";
  private financialModelingPrepKey = process.env.FINANCIAL_MODELING_PREP_KEY;
  private fetchNewCandles: boolean;
  private candles: Map<Ticker, Candle[]>;
  private earnings: Map<Ticker, FMPEarningsCalendar>;
  private dailyTenEMACache: Map<Ticker, number>;
  private dailyTwentyOneEMACache: Map<Ticker, number>;
  private dailyFiftySMACache: Map<Ticker, number>;
  private dailyTwoHundredSMACache: Map<Ticker, number>;

  constructor(@inject(TYPES.S3Client) private s3Client: S3Client) {
    this.candles = new Map<Ticker, Candle[]>();
    this.earnings = new Map<Ticker, FMPEarningsCalendar>();
    this.dailyTwentyOneEMACache = new Map<Ticker, number>();
    this.dailyTenEMACache = new Map<Ticker, number>();
    this.dailyFiftySMACache = new Map<Ticker, number>();
    this.dailyTwoHundredSMACache = new Map<Ticker, number>();
    this.fetchNewCandles = parseBooleanEnv(
      process.env.CACHE_FETCH_NEW_CANDLES,
      false
    );
  }

  private static tryParseHistoricalFMP(data: JSON): Candle[] | DataError {
    try {
      const parsed = FMPHistoricalResultSchema.parse(data);
      return parsed.historical.map((candle) => ({
        date: dateSringToMillisSinceEpochInET(candle.date),
        dateStr: candle.date,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      }));
    } catch (err) {
      console.log(err);
      return { errorMessage: `Unable to parse candles from FMP` };
    }
  }

  private static async getDailyCandlesFromFMP(
    symbol: Ticker,
    startDate: string | undefined,
    endDate: string | undefined
  ): Promise<Candle[] | DataError> {
    const FINANCIAL_MODELING_PREP_URL = "https://financialmodelingprep.com/api";
    const financialModelingPrepKey = process.env.FINANCIAL_MODELING_PREP_KEY;
    let url = `${FINANCIAL_MODELING_PREP_URL}/v3/historical-price-full/${symbol}?apikey=${financialModelingPrepKey}`;

    if (startDate && endDate) {
      url += `&from=${startDate}&to=${endDate}`;
    } else if (startDate) {
      url += `&from=${startDate}`;
    } else if (endDate) {
      url += `&to=${endDate}`;
    }

    try {
      const response = await axios.get(url);
      const data = response.data;
      return DailyCacheService.tryParseHistoricalFMP(data);
    } catch (error) {
      // Handle any errors that might occur during the fetch or validation process
      const dataError: DataError = { errorMessage: "Error: " + error.message };

      return dataError;
    }
  }

  public getCandles(symbol: Ticker): Candle[] {
    const data = this.candles.get(symbol);
    if (data) {
      const compareFn = (a: Candle, b: Candle) => a.date - b.date;

      // Sort the candles array in ascending order by date
      const sorted = data.sort(compareFn);
      return sorted;
    } else return [];
  }

  public getLastDate(): string | undefined {
    const spyCandles = this.getCandles("SPY");

    return spyCandles ? spyCandles[spyCandles.length - 1].dateStr : undefined;
  }

  public getCandlesWithFilter(
    symbol: Ticker,
    filter: (candle: Candle) => boolean
  ): Candle[] {
    const candles = this.candles.get(symbol);

    if (candles) {
      return candles.filter(filter);
    } else {
      return [];
    }
  }

  public getEarningsCalendar(ticker: Ticker): FMPEarningsCalendar | undefined {
    return this.earnings.get(ticker);
  }

  public getAllData(): Map<Ticker, Candle[]> {
    return this.candles;
  }

  public async initializeCache(): Promise<void> {
    console.log("Cache loading...");

    const bucketName = "marketgenerated";
    const keys = (await this.listAllObjectKeys(bucketName)).filter(
      (k) => k.endsWith(".gz") && k.includes("marketdata-fmp/")
    );

    const processBatch = async (batchKeys: string[]): Promise<CacheEntry[]> => {
      const batchPromises = batchKeys.map(async (k) => {
        const symbol = k
          .replace("marketdata-fmp/", "")
          .replace(".gz", "")
          .trim();
        const data = await this.getObjectContentFromS3(bucketName, k);

        const candlesFromS3 = this.tryParseCandlesStringS3(JSON.parse(data));

        if (Array.isArray(candlesFromS3) && candlesFromS3.every(isCandle)) {
          return {
            symbol: symbol,
            candles: candlesFromS3,
          };
        } else {
          console.error(`Error parsing candles for ${k}`);
          return undefined;
        }
      });

      const batchCacheEntries: (CacheEntry | undefined)[] = await Promise.all(
        batchPromises
      );
      return batchCacheEntries.filter(isCacheEntry).map((entry) => entry!);
    };

    const batchSize = 25;
    const cacheEntries: CacheEntry[] = [];

    for (let i = 0; i < keys.length; i += batchSize) {
      const batchKeys = keys.slice(i, i + batchSize);
      const batchCacheEntries = await processBatch(batchKeys);
      cacheEntries.push(...batchCacheEntries);

      const percent = ((i + batchSize) * 100) / keys.length;
      if (cacheEntries.length % 100 === 0) {
        console.log(
          `Processed ${i + batchSize} of ${keys.length} keys (${percent.toFixed(
            2
          )}%)`
        );
      }
    }

    const processEarningsBatch = async (batchKeys: string[]): Promise<void> => {
      batchKeys.forEach(async (k) => {
        const symbol = k
          .replace("marketdata-fmp-earnings/", "")
          .replace(".gz", "")
          .trim();
        const data = await this.getObjectContentFromS3(bucketName, k);

        const earningsCalendar = this.tryParseEarningsCalendar(
          JSON.parse(data)
        );
        if (isFMPEarningsCalendar(earningsCalendar)) {
          this.earnings.set(symbol, earningsCalendar);
        }
      });
    };

    const earningsKeys = (await this.listAllObjectKeys(bucketName)).filter(
      (k) => k.endsWith(".gz") && k.includes("marketdata-fmp-earnings/")
    );

    const earningsCalendars: FMPEarningsCalendar[] = [];

    for (let i = 0; i < earningsKeys.length; i += batchSize) {
      const batchKeys = earningsKeys.slice(i, i + batchSize);
      await processEarningsBatch(batchKeys);

      const percent = ((i + batchSize) * 100) / earningsKeys.length;
      if (earningsCalendars.length % 100 === 0) {
        console.log(
          `Processed ${i + batchSize} of earnings ${
            keys.length
          } keys (${percent.toFixed(2)}%)`
        );
      }
    }

    if (this.fetchNewCandles) {
      const today = new Date();
      const rateLimiter = new Bottleneck({
        maxConcurrent: 50,
        minTime: (60 * 1000) / 749,
      });

      const updatedCacheEntries = await Promise.all(
        cacheEntries.map(async (entry) => {
          const lastDateLong = Math.max(...entry.candles.map((c) => c.date));
          const nextDate = addOneDay(lastDateLong);
          const startDate = formatDateFromMillisecondsToEST(nextDate);
          const endDate = formatDateToEST(today);

          if (
            startDate !== endDate ||
            (startDate === endDate && today.getHours() > 17)
          ) {
            const additionalCandles = await rateLimiter.schedule(() =>
              DailyCacheService.getDailyCandlesFromFMP(
                entry.symbol,
                startDate,
                endDate
              )
            );

            if (
              Array.isArray(additionalCandles) &&
              additionalCandles.every(isCandle)
            ) {
              console.log(
                `Fetched ${additionalCandles.length} candles from FMP for ${entry.symbol}`
              );
              const existingDates = entry.candles.map((c) => c.date);
              const filteredDuplicates = additionalCandles.filter(
                (c) => !existingDates.includes(c.date)
              );
              const combinedArray = [...filteredDuplicates, ...entry.candles];
              return {
                symbol: entry.symbol,
                candles: combinedArray,
              };
            } else {
              console.log(
                `Error fetching candles from FMP for ${entry.symbol}`
              );
            }
          }

          return entry;
        })
      );

      updatedCacheEntries.forEach((c) => {
        if (c) {
          this.candles.set(c.symbol, c.candles);
        }
      });

      console.log("Cache loading completed.");
    } else {
      cacheEntries.forEach((c) => {
        if (c) {
          this.candles.set(c.symbol, c.candles);
        }
      });

      console.log("Cache loading completed.");
    }
  }

  public getDailyTenEMA(ticker: Ticker): number | undefined {
    return this.dailyTenEMACache.get(ticker);
  }

  public getDailyTwentyOneEMA(ticker: Ticker): number | undefined {
    return this.dailyTwentyOneEMACache.get(ticker);
  }

  public getDailyFiftySMA(ticker: Ticker): number | undefined {
    return this.dailyFiftySMACache.get(ticker);
  }

  public getDailyTwoHundredSMA(ticker: Ticker): number | undefined {
    return this.dailyTwoHundredSMACache.get(ticker);
  }

  public initializeSMACaches(): void {
    console.log("initializing SMA Daily Caches");
    for (const [ticker, candles] of this.candles) {
      const sorted = [...candles].sort((a, b) => {
        if (a.date > b.date) {
          return 1;
        } else if (a.date < b.date) {
          return -1;
        }
        return 0;
      });

      const closes = sorted.map((c) => c.close);

      const tenEMARes = ema(10, closes);

      if (!isMovingAverageError(tenEMARes)) {
        this.dailyTenEMACache.set(ticker, tenEMARes);
      }

      const emaRes = ema(21, closes);

      if (!isMovingAverageError(emaRes)) {
        this.dailyTwentyOneEMACache.set(ticker, emaRes);
      }

      const fiftySMA = sma(50, closes);

      if (!isMovingAverageError(fiftySMA)) {
        this.dailyFiftySMACache.set(ticker, fiftySMA);
      }

      const twoHundredSMA = sma(200, closes);

      if (!isMovingAverageError(twoHundredSMA)) {
        this.dailyTwoHundredSMACache.set(ticker, twoHundredSMA);
      }
    }

    console.log("finished initializing 20SMA Daily Cache");
  }

  public async initializeFromLocalFilePath(filepath: string): Promise<void> {
    console.log("initializing cache from filesystem");
    this.candles = await this.loadCandlesFromFileSystem(filepath);
    console.log("cache initialization complete ");
  }

  private tryParseCandlesStringS3(data: JSON): Candle[] | DataError {
    try {
      const candles = FMPHistoricalArraySchema.parse(data);
      return candles.map((cached) => ({
        date: dateSringToMillisSinceEpochInET(cached.date),
        dateStr: cached.date,
        open: cached.open,
        high: cached.high,
        low: cached.low,
        close: cached.close,
        volume: cached.volume,
      }));
    } catch (err) {
      //console.log(err);
      return { errorMessage: `Unable to parse candles` };
    }
  }

  private tryParseEarningsCalendar(
    data: JSON
  ): FMPEarningsCalendar | DataError {
    try {
      const earningsCalendar = FMPEarningsCalendarSchema.parse(data);
      return earningsCalendar;
    } catch (err) {
      //console.log(err);
      return { errorMessage: `Unable to parse earnings calendar` };
    }
  }

  private tryParseCandlesStringTiingo(data: JSON): Candle[] | DataError {
    try {
      const candles = zodTiingoCandlesSchema().parse(data);
      const dateStringToLong = (dateString: string) => {
        const estDate = new Date(dateString);
        const estTimezoneOffsetInMilliseconds = -5 * 60 * 60 * 1000; // EST offset (-5 hours) in milliseconds

        const millisecondsSinceEpoch =
          estDate.getTime() - estTimezoneOffsetInMilliseconds;

        return millisecondsSinceEpoch;
      };

      return candles.map((cached) => ({
        date: dateStringToLong(cached.date),
        dateStr: cached.date,
        open: cached.adjOpen,
        high: cached.adjHigh,
        low: cached.adjLow,
        close: cached.close,
        volume: cached.volume,
      }));
    } catch (err) {
      console.log(err);
      return { errorMessage: `Unable to parse candles` };
    }
  }

  private async listAllObjectKeys(bucket: string) {
    let keys: string[] = [];
    let continuationToken: string | undefined = undefined;

    do {
      const listObjectsCommand: ListObjectsV2Command = new ListObjectsV2Command(
        {
          Bucket: bucket,
          ContinuationToken: continuationToken,
        }
      );

      try {
        const response = await this.s3Client.send(listObjectsCommand);
        if (response.Contents) {
          // Filter out undefined values and add valid strings to the keys array
          keys = keys.concat(
            response.Contents.map((object: _Object) => object.Key).filter(
              Boolean
            ) as string[]
          );
        }
        continuationToken = response.NextContinuationToken;
      } catch (error) {
        console.error("Error:", error);
        break;
      }
    } while (continuationToken);

    return keys;
  }

  private async getObjectContentFromS3(
    bucket: string,
    key: string
  ): Promise<string> {
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(getObjectCommand);

      const gunzip = createGunzip();
      const pipelinePromise = pipeline(
        response.Body as NodeJS.ReadableStream,
        gunzip
      );

      const chunks: Buffer[] = [];
      gunzip.on("data", (chunk: Buffer) => chunks.push(chunk));
      gunzip.on("end", () => {});

      await pipelinePromise;

      const decompressedData = Buffer.concat(chunks).toString();
      return decompressedData;
    } catch (error) {
      console.error(`Error retrieving object ${key}:`, error);
      throw error;
    }
  }

  private async getDailyCandlesFromTiingo(
    symbol: Ticker,
    startDate: string | undefined,
    endDate: string | undefined
  ): Promise<Candle[] | DataError> {
    let url = `${this.TIINGO_URL}/daily/${symbol}/prices?token=${this.tiingoKey}`;

    if (startDate && endDate) {
      url += `&startDate=${startDate}&endDate=${endDate}`;
    } else if (startDate) {
      url += `&startDate=${startDate}`;
    } else if (endDate) {
      url += `&endDate=${endDate}`;
    }

    try {
      const response = await axios.get(url);
      const data = response.data;
      return this.tryParseCandlesStringTiingo(data);
    } catch (error) {
      // Handle any errors that might occur during the fetch or validation process
      const dataError: DataError = { errorMessage: "Error: " + error.message };

      return dataError;
    }
  }

  public async persistCandlesToFileSystem(filepath: string): Promise<void> {
    try {
      for (const [symbol, candles] of this.candles.entries()) {
        const cacheEntry: CacheEntry = {
          symbol,
          candles,
        };

        // Convert the cache entry to JSON
        const jsonData = JSON.stringify(cacheEntry);

        // Compress the JSON data using gzip
        const compressedData = zlib.gzipSync(jsonData);

        // Generate the file name based on the symbol
        const filename = `${symbol}.json.gz`;

        // Write the compressed data to the file
        await fs.writeFile(`${filepath}/${filename}`, compressedData);

        console.log(
          `Candles data for ${symbol} has been written to ${filename}`
        );
      }

      console.log("All candles data has been persisted to files.");
    } catch (error) {
      console.error("Error while persisting candles data:", error);
    }
  }

  private async loadCandlesFromFileSystem(
    filepath: string
  ): Promise<Map<string, Candle[]>> {
    try {
      const candlesMap: Map<string, Candle[]> = new Map();

      const fileNames = await fs.readdir(filepath);

      // Loop through each file
      for (const filename of fileNames) {
        // Skip non-json.gz files
        if (!filename.endsWith(".json.gz")) {
          continue;
        }

        // Read the gzipped JSON data from the file
        const compressedData = await fs.readFile(`${filepath}/${filename}`);

        // Decompress the data using gzip
        const jsonData = zlib.gunzipSync(compressedData).toString("utf8");

        // Parse the JSON data to get the cache entry
        const cacheEntry: CacheEntry = JSON.parse(jsonData);

        const sorted = [...cacheEntry.candles].sort((a, b) => {
          if (a.date > b.date) {
            return 1;
          } else if (a.date < b.date) {
            return -1;
          }
          return 0;
        });

        candlesMap.set(cacheEntry.symbol, sorted);
      }

      console.log("Candles data has been loaded from files.");
      return candlesMap;
    } catch (error) {
      console.error("Error while loading candles data:", error);
      return new Map(); // Return an empty map in case of an error
    }
  }
}
