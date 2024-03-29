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
  ScanMatchResponse,
  ScanResultsWithRows,
  isScanResults,
} from "./scan-types";
import { Ticker, isRight, match } from "../../MarketGeneratedTypes";
import { formatDateToEST, getDateNMonthsAgo } from "../../utils/epoch_utils";
import { Candle } from "../../modles/candle";
import { SymbolService } from "../symbol/symbol_service";
import { FMPSymbolProfileData } from "../financial_modeling_prep_types";
import { RelativeStrengthService } from "../relative-strength/relative-strength-service";
import { PredefinedScanResponse } from "../../controllers/scans/scan-request-responses";
import { adrPercent, isADRPercentError } from "../../indicators/adr-percent";
import { date, map } from "zod";
import { TableResponseRow } from "../response-types";
import {
  ema,
  isMovingAverageError,
  sma,
} from "../../indicators/moving-average";
import { IndicatorsService } from "../indicator/indicator-service";

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
    @inject(TYPES.IndicatorService)
    private readonly indicatorService: IndicatorsService,
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

  public async getScanResultsForTicker(
    ticker: Ticker
  ): Promise<ScanMatchResponse[]> {
    const fromDB = await this.repo.getScanResultsForTicker(ticker);

    return fromDB.map((r) => {
      const mapped = {
        ticker: ticker,
        date: r.date,
        scanName: r.scanName,
        scanId: r.scanId,
      };
      return mapped;
    });
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
              (row): row is TableResponseRow => row !== undefined
            ),
            stocks: stockRows.filter(
              (row): row is TableResponseRow => row !== undefined
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
      (row): row is ScanResultsWithRows =>
        row !== undefined && row?.scanId != null
    );
  }

  private buildScanResultRow(ticker: Ticker): TableResponseRow | undefined {
    const profile = this.profiles.find((p) => p.Symbol === ticker);
    if (!profile) {
      //console.error(`Could not find profile for ${ticker}`);
      return undefined;
    }
    const startDate = getDateNMonthsAgo(12);
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

    const isInside =
      lastCandle.high <= previous.high && lastCandle.low >= previous.low;
    const percentChange =
      ((lastCandle.close - previous.close) / previous.close) * 100;

    // Get the volume of the last candle
    const lastVolume = candles[candles.length - 1].volume;

    const past40VolumeSum = candles
      .slice(-41, -1)
      .reduce((sum, candle) => sum + candle.volume, 0);

    const averageVolumePast40Days = past40VolumeSum / 40;
    const relativeVolume = (lastVolume / averageVolumePast40Days) * 100;
    const closes = candles.map((c) => c.close);

    const adrP = adrPercent(candles, 20);
    const tenEMAOrError = ema(10, closes);
    const twentyOneEMAOrError = ema(21, closes);
    const fiftySMAOrError = sma(50, closes);
    const twoHundredSMAOrError = sma(200, closes);

    let atAVWAPE = false;
    const earnings = this.cacheService.getEarningsCalendar(ticker);

    if (earnings && earnings.length > 1) {
      // Sort the earnings array by date in descending order
      const filteredEarnings = earnings
        .filter((e) => e.eps != null)
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

      const lastTwoEarningsDates = filteredEarnings.slice(-2);
      const [prevEarningsAVWAP, lastEarningsAVWAP] = lastTwoEarningsDates.map(
        (e) => {
          const eDate = new Date(e.date);

          if (e.time === "amc") {
            eDate.setDate(eDate.getDate() + 1);
          }

          const dateStr = formatDateToEST(eDate);

          return this.indicatorService.anchoredVWAP(ticker, dateStr);
        }
      );

      if (
        prevEarningsAVWAP &&
        lastEarningsAVWAP &&
        isRight(prevEarningsAVWAP) &&
        isRight(lastEarningsAVWAP)
      ) {
        const lastAVWap =
          lastEarningsAVWAP.value[lastEarningsAVWAP.value.length - 1];
        if (
          lastAVWap &&
          lastAVWap.value &&
          lastCandle.low <= lastAVWap.value &&
          lastCandle.high > lastAVWap.value
        ) {
          atAVWAPE = true;
        }

        const prevAVWAP =
          prevEarningsAVWAP.value[prevEarningsAVWAP.value.length - 1];
        if (
          prevAVWAP &&
          prevAVWAP.value &&
          lastCandle.low <= prevAVWAP.value &&
          lastCandle.high > prevAVWAP.value
        ) {
          atAVWAPE = true;
        }
      }
    }

    const result: TableResponseRow = {
      ticker: ticker,
      name: profile.companyName,
      exchange: profile.exchangeShortName,
      last: lastCandle,
      isInsideBar: isInside,
      atEarningsAVWap: atAVWAPE,
      percentChange: Number(percentChange.toFixed(2)),
      marketCap: profile.MktCap,
      adrP: !isADRPercentError(adrP) ? Number(adrP.toFixed(2)) : 0,
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
      tenEMA: !isMovingAverageError(tenEMAOrError) ? tenEMAOrError : undefined,
      twentyOneEMA: !isMovingAverageError(twentyOneEMAOrError)
        ? twentyOneEMAOrError
        : undefined,
      fiftySMA: !isMovingAverageError(fiftySMAOrError)
        ? fiftySMAOrError
        : undefined,
      twoHundredSMA: !isMovingAverageError(twoHundredSMAOrError)
        ? twoHundredSMAOrError
        : undefined,
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
