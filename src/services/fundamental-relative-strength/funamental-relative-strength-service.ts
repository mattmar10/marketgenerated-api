import { inject, injectable } from "inversify";
import { SymbolService } from "../symbol/symbol_service";
import TYPES from "../../types";
import { Ticker, match } from "../../MarketGeneratedTypes";
import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";

import {
  calculateLinearRegression,
  calculateLinearRegressionFromNumbers,
  isLinearRegressionResult,
} from "../../indicators/linear-regression";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

type FundamentalStrengthScore = {
  symbol: Ticker;
  score: number;
};

export type FundamentalStrengthScoreAndRank = FundamentalStrengthScore & {
  rank: number;
};

export type FundamentalCachedData = {
  stocks: FundamentalStrengthScoreAndRank[];
  etfs: FundamentalStrengthScoreAndRank[];
};

const bucketName = "marketgenerated";
const key = "marketdata-fmp/fundamental-ranking.json.gz";

@injectable()
export class FundamentalRelativeStrengthService {
  private stockRankings: FundamentalStrengthScoreAndRank[] = [];
  private etfRankings: FundamentalStrengthScoreAndRank[] = [];

  constructor(
    @inject(TYPES.SymbolService) private symbolService: SymbolService,
    @inject(TYPES.S3Client) private s3Client: S3Client
  ) {}

  public async initialize() {
    console.log("Building fundamental score data");
    const stocks = this.symbolService.getStocks();
    const etfs = this.symbolService.getEtfs();

    const universeOfStockKeys = stocks.map((s) => s.Symbol);
    const universeOfEtfKeys = etfs.map((e) => e.Symbol);

    const combinedUniverse = [...universeOfStockKeys, ...universeOfEtfKeys];

    const fromS3 = await this.getDataFromS3(bucketName, key);
    const parsed: FundamentalCachedData = JSON.parse(fromS3);

    this.stockRankings = parsed.stocks;
    this.etfRankings = parsed.etfs;
  }

  private async getDataFromS3(bucket: string, key: string): Promise<string> {
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

  public getFundamentalRankAndScoreForSymbol(
    symbol: Ticker
  ): FundamentalStrengthScoreAndRank | undefined {
    const stockData = this.stockRankings.find((sr) => sr.symbol === symbol);

    if (stockData) {
      return stockData;
    } else {
      return this.etfRankings.find((er) => er.symbol === symbol);
    }
  }

  public getTopStockFundamentalRelativeStrengthPerformers(top: number = 100) {
    function sortByRank(
      a: FundamentalStrengthScoreAndRank,
      b: FundamentalStrengthScoreAndRank
    ) {
      return b.rank - a.rank;
    }
    const maxCount = Math.min(this.stockRankings.length, top);
    return [...this.stockRankings].sort(sortByRank).slice(0, maxCount);
  }

  public getTopEtfFundamentalRelativeStrengthPerformers(top: number = 100) {
    function sortByRank(
      a: FundamentalStrengthScoreAndRank,
      b: FundamentalStrengthScoreAndRank
    ) {
      return b.rank - a.rank;
    }
    const maxCount = Math.min(this.stockRankings.length, top);
    return [...this.etfRankings].sort(sortByRank).slice(0, maxCount);
  }
}
