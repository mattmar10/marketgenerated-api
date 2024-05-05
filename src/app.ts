import "reflect-metadata";
import * as bodyParser from "body-parser";
import * as dotenv from "dotenv";
import { Container } from "inversify";
import { InversifyExpressServer } from "inversify-express-utils";
import { S3Client } from "@aws-sdk/client-s3";
import TYPES from "./types";
import { DailyCacheService } from "./services/daily_cache_service";
import { SymbolService } from "./services/symbol/symbol_service";
import { OverviewService } from "./services/overview/overview-service";

import "./controllers/daily/daily-controller";
import "./controllers/overview/overview-controller";
import "./controllers/health-controller";
import "./controllers/indicators/indicators-controller";
import "./controllers/symbol/symbol-controller";
import "./controllers/relative-strength/relative-strength-controller";
import "./controllers/fundamental-relative-strength/fundamental-relative-strength-controller";
import "./controllers/search/search-controller";
import "./controllers/screener/screener-controller";
import "./controllers/weekly/weekly-controller";
import "./controllers/scans/scans-controller";
import "./controllers/volume-surge/volume-surge-controller";
import "./controllers/market-breadth/market-breadth-controller";

import { SearchService } from "./services/search/search_service";
import { ScreenerService } from "./services/screener/screener-service";
import { RelativeStrengthService } from "./services/relative-strength/relative-strength-service";
import { StockIndexService } from "./services/stock-index/stock-index-service";
import { LevelsService } from "./services/levels/levels-service";
import { FundamentalRelativeStrengthService } from "./services/fundamental-relative-strength/funamental-relative-strength-service";
import { IndicatorsService } from "./services/indicator/indicator-service";
import { Client, Pool } from "pg";
import { ScanRepository } from "./repositories/scan/scan-repository";
import { ScanService } from "./services/scan/scan-service";
import { getPGConfig } from "./utils/pg-utils";
import { VolumeSurgeService } from "./services/volume-surge/volume-surge-service";
import { MarketBreadthService } from "./services/breadth/market-breadth-service";
import { RealtimeQuoteService } from "./services/realtime-quote-service";

// Load environment variables from .env file
(async () => {
  dotenv.config();

  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const tiingoKey = process.env.TIINGO_KEY;
  const financialModelingPrepKey = process.env.FINANCIAL_MODELING_PREP_KEY;
  const initCacheFromFileSystem = process.env.USE_LOCAL_CACHE
    ? process.env.USE_LOCAL_CACHE === "true"
    : false;
  const localCachePath = process.env.LOCAL_CACHE_PATH;

  const PG_DB_HOST = process.env.MG_DB_HOST;
  const PG_DB_DATABASE = process.env.MG_DB_DATABASE;
  const PG_DB_USER = process.env.MG_DB_USER;
  const PG_DB_PASSWORD = process.env.MG_DB_PASSWORD;

  const pool = new Pool({
    user: PG_DB_USER,
    password: PG_DB_PASSWORD,
    database: PG_DB_DATABASE,
    host: PG_DB_HOST,
    port: 5432,
    max: 5, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  });

  const dbPool = new Pool(await getPGConfig());

  if (!PG_DB_DATABASE || !PG_DB_HOST || !PG_DB_PASSWORD || !PG_DB_USER) {
    console.error("Missing required environment variables for Postgres");
    process.exit(1);
  }

  //const pgClient = new Client(dbConfig);
  //await pgClient.connect();

  if (!process.env.SCAN_FOLDER || !process.env.SCAN_BUCKET) {
    console.error("Missing required environment variables for scans");
    process.exit(1);
  }

  if (!accessKey || !secretAccessKey) {
    console.error("Missing required environment variables for AWS");
    process.exit(1);
  } else if (!tiingoKey) {
    console.error("Missing required environment variables for Tiingo");
    process.exit(1);
  } else if (!financialModelingPrepKey) {
    console.error(
      "Missing required environment variables for Financial Modeling Prep"
    );
    process.exit(1);
  }

  const client = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretAccessKey,
    },
  });

  // set up container
  const container = new Container();

  container.bind<S3Client>(TYPES.S3Client).toConstantValue(client);
  //container.bind<Client>(TYPES.PGClient).toConstantValue(pgClient);

  container.bind<Pool>(TYPES.PGPool).toConstantValue(dbPool);

  // create server
  const server = new InversifyExpressServer(container);
  container
    .bind<SymbolService>(TYPES.SymbolService)
    .to(SymbolService)
    .inSingletonScope();

  const symbolService = container.get<SymbolService>(TYPES.SymbolService);
  console.time("Symbol Service Initialization");
  await symbolService.initialize();
  console.timeEnd("Symbol Service Initialization");

  container
    .bind<DailyCacheService>(TYPES.DailyCacheService)
    .to(DailyCacheService)
    .inSingletonScope();

  // Retrieve instance of DailyCacheService from the container
  const dailyCacheService = container.get<DailyCacheService>(
    TYPES.DailyCacheService
  );

  // Call the loadCache method
  console.time("Daily Cache Service Initialization");
  //await dailyCacheService.initializeCache();
  if (initCacheFromFileSystem && localCachePath) {
    console.log(`initializing cache from local file path: ${localCachePath}`);
    await dailyCacheService.initializeFromLocalFilePath(localCachePath);
  } else {
    await dailyCacheService.initializeCache();
    dailyCacheService.initializeSMACaches();
  }
  console.timeEnd("Daily Cache Service Initialization");

  container
    .bind<VolumeSurgeService>(TYPES.VolumeSurgeService)
    .to(VolumeSurgeService)
    .inSingletonScope();

  const volumeSurgeService = container.get<VolumeSurgeService>(
    TYPES.VolumeSurgeService
  );
  volumeSurgeService.startPolling();

  container
    .bind<IndicatorsService>(TYPES.IndicatorService)
    .to(IndicatorsService)
    .inSingletonScope();

  container
    .bind<LevelsService>(TYPES.LevelsService)
    .to(LevelsService)
    .inSingletonScope();

  container
    .bind<OverviewService>(TYPES.OverviewService)
    .to(OverviewService)
    .inSingletonScope();

  container
    .bind<MarketBreadthService>(TYPES.MarketBreadthService)
    .to(MarketBreadthService)
    .inSingletonScope();

  container
    .bind<RelativeStrengthService>(TYPES.RelativeStrengthService)
    .to(RelativeStrengthService)
    .inSingletonScope();

  const relativeStrenghService = container.get<RelativeStrengthService>(
    TYPES.RelativeStrengthService
  );

  relativeStrenghService.initializeRelativeStrengthData();
  relativeStrenghService.initializeRelativeStrengthsBySlopeData();

  container
    .bind<SearchService>(TYPES.SearchService)
    .to(SearchService)
    .inSingletonScope();

  container
    .bind<StockIndexService>(TYPES.StockIndexService)
    .to(StockIndexService)
    .inSingletonScope();

  container
    .bind<FundamentalRelativeStrengthService>(
      TYPES.FundamentalRelativeStrengthService
    )
    .to(FundamentalRelativeStrengthService)
    .inSingletonScope();

  const fundamentalRelativeStrenghService =
    container.get<FundamentalRelativeStrengthService>(
      TYPES.FundamentalRelativeStrengthService
    );

  console.log("initializing funamental relative strengths service");
  await fundamentalRelativeStrenghService.initialize();

  console.log("initializing screener service");
  container
    .bind<ScreenerService>(TYPES.ScreenerService)
    .to(ScreenerService)
    .inSingletonScope();

  container
    .bind<ScanRepository>(TYPES.ScanRepository)
    .to(ScanRepository)
    .inSingletonScope();

  container
    .bind<ScanService>(TYPES.ScanService)
    .to(ScanService)
    .inSingletonScope();

  const scanService = container.get<ScanService>(TYPES.ScanService);
  scanService.initialize();

  container
    .bind<RealtimeQuoteService>(TYPES.RealtimeQuoteService)
    .to(RealtimeQuoteService)
    .inSingletonScope();

  const realtimeQuoteService = container.get<RealtimeQuoteService>(
    TYPES.RealtimeQuoteService
  );
  realtimeQuoteService.initialize();

  server.setConfig((app) => {
    app.use(
      bodyParser.urlencoded({
        extended: true,
      })
    );
    app.use(bodyParser.json());
  });

  const app = server.build();

  app.listen(8777);
  console.log("Started api");
})();
