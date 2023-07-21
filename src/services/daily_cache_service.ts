import { inject, injectable } from "inversify";
import { Candle, isCandle } from "../modles/candle";
import { Ticker } from "../MarketGeneratedTypes";
import TYPES from "../types";

import {
  ListObjectsV2Command,
  GetObjectCommand,
  S3Client,
  _Object,
} from "@aws-sdk/client-s3";

import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { DataError } from "./data_error";
import {
  zodS3CandleSchema,
  zodS3CandlesSchema,
  zodTiingoCandlesSchema,
} from "./tiingo_types";

import {
  addOneDay,
  formatDateFromMillisecondsToEST,
  formatDateToEST,
} from "../utils/epoch_utils";
import axios from "axios";

interface CacheEntry {
  symbol: Ticker;
  candles: Candle[];
}

@injectable()
export class DailyCacheService {
  private TIINGO_URL = "https://api.tiingo.com/tiingo";
  private tiingoKey = process.env.TIINGO_KEY;
  private candles: Map<Ticker, Candle[]>;

  constructor(@inject(TYPES.S3Client) private s3Client: S3Client) {
    this.candles = new Map<Ticker, Candle[]>();
  }

  public getCandles(symbol: Ticker): Candle[] {
    const data = this.candles.get(symbol);
    if (data) return data;
    else return [];
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

  public getAllData(): Map<Ticker, Candle[]> {
    return this.candles;
  }

  public async initializeCache(): Promise<void> {
    // Perform cache loading logic here
    console.log("Cache loading...");

    const bucketName = "marketgenerated";
    const keys = (await this.listAllObjectKeys(bucketName)).filter((k) =>
      k.endsWith(".gz")
    );

    const promises = keys.map(async (k) => {
      const symbol = k.replace("marketdata/", "").replace(".gz", "").trim();
      const data = await this.getObjectContentFromS3(bucketName, k);
      //console.log(`Parsing data for ${symbol} from S3...`);
      const candlesFromS3 = this.tryParseCandlesStringS3(JSON.parse(data));

      if (
        Array.isArray(candlesFromS3) &&
        candlesFromS3.every((item) => isCandle(item))
      ) {
        const today = new Date();
        const lastDateLong = Math.max(...candlesFromS3.map((c) => c.date));
        const nextDate = addOneDay(lastDateLong);

        const startDate = formatDateFromMillisecondsToEST(nextDate);
        const endDate = formatDateToEST(today);

        if (
          startDate !== endDate ||
          (startDate == endDate && today.getHours() > 17)
        ) {
          const additionalCandles = await this.getDailyCandlesFromTiingo(
            symbol,
            startDate,
            endDate
          );
          let candlesFromTiingo: Candle[] = [];
          if (
            Array.isArray(additionalCandles) &&
            additionalCandles.every((c) => isCandle(c))
          ) {
            candlesFromTiingo = additionalCandles;
            console.log(
              `fetched ${candlesFromTiingo.length} candles from tiingo for ${symbol}`
            );
          } else {
            console.log(`Error fetching candles from Tiingo for ${symbol}`);
          }

          const combinedArray = [...candlesFromS3, ...candlesFromTiingo];
          const cacheEntry: CacheEntry = {
            symbol: symbol,
            candles: combinedArray,
          };
          return cacheEntry;
        } else {
          const cacheEntry: CacheEntry = {
            symbol: symbol,
            candles: candlesFromS3,
          };
          return cacheEntry;
        }
      }
    });

    const cacheEntries = await Promise.all(promises);

    cacheEntries.forEach((c) => {
      if (c) {
        this.candles.set(c.symbol, c.candles);
      }
    });

    console.log("Cache loading completed.");
  }

  private tryParseCandlesStringS3(data: JSON): Candle[] | DataError {
    try {
      const candles = zodS3CandlesSchema().parse(data);
      return candles.map((cached) => ({
        date: cached.dt,
        open: cached.adjOpen,
        high: cached.adjHigh,
        low: cached.adjLow,
        close: cached.adjClose,
        volume: cached.volume,
      }));
    } catch (err) {
      console.log(err);
      return { errorMessage: `Unable to parse candles` };
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
        open: cached.adjOpen,
        high: cached.adjHigh,
        low: cached.adjLow,
        close: cached.adjClose,
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
}
