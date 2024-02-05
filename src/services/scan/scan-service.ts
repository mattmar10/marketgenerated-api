import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { PredefinedScanInfo } from "../../repositories/scan/scan-models";
import { ScanRepository } from "../../repositories/scan/scan-repository";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
  _Object,
} from "@aws-sdk/client-s3";
import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { DailyCacheService } from "../daily_cache_service";
import {
  ScanIdentifier,
  ScanResponseRow,
  ScanResultsWithRows,
  isScanResults,
} from "./scan-types";
import { Ticker } from "../../MarketGeneratedTypes";
import { getDateNMonthsAgo } from "../../utils/epoch_utils";
import { Candle } from "../../modles/candle";
import { SymbolService } from "../symbol/symbol_service";
import { FMPSymbolProfileData } from "../financial_modeling_prep_types";
import { RelativeStrengthService } from "../relative-strength/relative-strength-service";
import { PredefinedScanResponse } from "../../controllers/scans/scan-request-responses";

@injectable()
export class ScanService {
  readonly bucketName = process.env.SCAN_BUCKET || "marketgenerated";
  readonly scanFolder = process.env.SCAN_FOLDER || "scans";

  readonly profiles: FMPSymbolProfileData[];

  private latestScanResults: ScanResultsWithRows[] = [];

  constructor(
    @inject(TYPES.SymbolService) private readonly symbolService: SymbolService,
    @inject(TYPES.RelativeStrengthService)
    private readonly relativeStrengthService: RelativeStrengthService,
    @inject(TYPES.DailyCacheService)
    private readonly cacheService: DailyCacheService,
    @inject(TYPES.ScanRepository) private readonly repo: ScanRepository,
    @inject(TYPES.S3Client) private readonly s3Client: S3Client
  ) {
    this.profiles = [...symbolService.getStocks(), ...symbolService.getEtfs()];
  }

  public async getPredefinedScans(): Promise<PredefinedScanResponse[]> {
    const toReturn: PredefinedScanResponse[] = [];
    const fromDB = await this.repo.getScans();

    for (let i = 0; i < fromDB.length; i++) {
      const dbScan = fromDB[i];
      const latestResult = this.latestScanResults.find(
        (s) => s.scanId === dbScan.s3Identifier
      );

      if (latestResult) {
        const resp: PredefinedScanResponse = {
          name: dbScan.name,
          description: dbScan.description,
          scanId: dbScan.s3Identifier,
          advanced: dbScan.advanced,
          lastUpdatedDate: latestResult.completionTime,
          latestResultCount:
            latestResult.etfs.length + latestResult.stocks.length,
        };

        toReturn.push(resp);
      } else {
        console.error(`Unable to find latest restult for scan ${dbScan.name}`);
      }
    }

    return toReturn;
  }

  public getLatestScanResults(
    scanId: ScanIdentifier
  ): ScanResultsWithRows | undefined {
    return this.latestScanResults.find((s) => s.scanId === scanId);
  }

  public async initialize() {
    console.log("Fetching scans from the DB");
    const scans = await this.repo.getScans();
    console.log(`Found ${scans.length} scans`);

    const promises = scans.map(async (s) => {
      const keys = await this.listObjects(
        this.bucketName,
        `${this.scanFolder}/latest/${s.s3Identifier}`
      );

      if (keys && keys.length === 1) {
        const content = await this.getObjectContentFromS3(
          this.bucketName,
          keys[0]
        );
        const parsed = JSON.parse(content);

        if (isScanResults(parsed)) {
          const etfRows = parsed.results.etfs.map((e) =>
            this.buildScanResultRow(e)
          );
          const stockRows = parsed.results.stocks.map((s) =>
            this.buildScanResultRow(s)
          );

          const scanToAdd: ScanResultsWithRows = {
            scanId: s.s3Identifier,
            completionTime: parsed.completionTime,
            scanName: s.name,
            description: s.description,
            etfs: etfRows.filter(
              (row): row is ScanResponseRow => row !== undefined
            ),
            stocks: stockRows.filter(
              (row): row is ScanResponseRow => row !== undefined
            ),
          };

          return scanToAdd;
        }
      } else {
        console.error(
          `Unable to read scan results for ${s.s3Identifier}. Found ${keys}`
        );
      }

      return null;
    });
    const fromDB = await Promise.all(promises);

    this.latestScanResults = fromDB.filter(
      (row): row is ScanResultsWithRows => row !== undefined
    );
  }

  private buildScanResultRow(ticker: Ticker): ScanResponseRow | undefined {
    const profile = this.profiles.find((p) => p.Symbol === ticker);
    if (!profile) {
      console.error(`Could not find profile for ${ticker}`);
      return undefined;
    }
    const startDate = getDateNMonthsAgo(2);
    const filterFn = (candle: Candle) => candle.date >= startDate.getTime();

    const candles = this.cacheService.getCandlesWithFilter(ticker, filterFn);
    candles.sort((a, b) => {
      if (a.date > b.date) {
        return 1;
      } else if (a.date < b.date) {
        return -1;
      }
      return 0;
    });

    if (
      candles.length < 2 ||
      !candles[candles.length - 1].close ||
      !candles[candles.length - 2].close ||
      !candles[candles.length - 1].volume
    ) {
      console.error(
        `cannot build scan row from ${ticker} - missing close or volume data`
      );
      return undefined;
    }

    const lastCandle = candles[candles.length - 1];
    const previous = candles[candles.length - 2];

    const percentChange =
      ((lastCandle.close - previous.close) / previous.close) * 100;

    // Get the volume of the last candle
    const lastVolume = candles[candles.length - 1].volume;

    const past40VolumeSum = candles
      .slice(-41, -1)
      .reduce((sum, candle) => sum + candle.volume, 0);

    const relativeVolume = (lastVolume / past40VolumeSum) * 100;

    const result: ScanResponseRow = {
      ticker: ticker,
      name: profile.companyName,
      price: lastCandle.close,
      percentChange: Number(percentChange.toFixed(2)),
      marketCap: profile.MktCap,
      volume: lastCandle.volume,
      rVolume: Number(relativeVolume.toFixed(2)),
      rsRankFromSlope:
        this.relativeStrengthService.getRelativeStrengthFromSlope(ticker),
      compositeRelativeStrengthRank:
        this.relativeStrengthService.getCompositeRelativeStrengthForSymbol(
          ticker
        ),
      sector: profile.sector,
      industry: profile.industry,
    };

    return result;
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

  private listObjects = async (
    bucket: string,
    folder: string
  ): Promise<string[]> => {
    const bucketName = bucket;
    const folderPrefix = `${folder}/`;

    const params = {
      Bucket: bucketName,
      Prefix: folderPrefix,
    };

    try {
      const command = new ListObjectsV2Command(params);
      const response = await this.s3Client.send(command);
      const keys: string[] = [];

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            keys.push(obj.Key);
          }
        }
      }
      return keys;
    } catch (error) {
      console.error("Error listing objects:", error);
      throw error;
    }
  };
}
