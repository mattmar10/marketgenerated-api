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
import "./controllers/symbol/symbol-controller";
import "./controllers/relative-strength/relative-strength-controller";
import "./controllers/fundamental-relative-strength/fundamental-relative-strength-controller";
import "./controllers/search/search-controller";
import "./controllers/screener/screener-controller";
import "./controllers/weekly/weekly-controller";

import { SearchService } from "./services/search/search_service";
import { ScreenerService } from "./services/screener/screener-service";
import { RelativeStrengthService } from "./services/relative-strength/relative-strength-service";
import { StockIndexService } from "./services/stock-index/stock-index-service";
import { LevelsService } from "./services/levels/levels-service";
import { FundamentalRelativeStrengthService } from "./services/fundamental-relative-strength/funamental-relative-strength-service";

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
  }
  console.timeEnd("Daily Cache Service Initialization");

  container
    .bind<LevelsService>(TYPES.LevelsService)
    .to(LevelsService)
    .inSingletonScope();

  container
    .bind<OverviewService>(TYPES.OverviewService)
    .to(OverviewService)
    .inSingletonScope();

  container
    .bind<RelativeStrengthService>(TYPES.RelativeStrengthService)
    .to(RelativeStrengthService)
    .inSingletonScope();

  const relativeStrenghService = container.get<RelativeStrengthService>(
    TYPES.RelativeStrengthService
  );

  relativeStrenghService.initializeRelativeStrengthData();

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
