import "reflect-metadata";
import * as bodyParser from "body-parser";
import * as dotenv from "dotenv";
import { Container } from "inversify";
import { InversifyExpressServer } from "inversify-express-utils";
import { S3Client } from "@aws-sdk/client-s3";
import TYPES from "./types";
import { DailyCacheService } from "./services/daily_cache_service";
import { SymbolService } from "./services/symbol_service";
import { OverviewService } from "./services/overview/overview-service";

import "./controllers/daily-controller";
import "./controllers/overview/overview-controller";
import "./controllers/health-controller";

// Load environment variables from .env file
(async () => {
  dotenv.config();

  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const tiingoKey = process.env.TIINGO_KEY;

  if (!accessKey || !secretAccessKey) {
    console.error("Missing required environment variables for AWS");
    process.exit(1);
  } else if (!tiingoKey) {
    console.error("Missing required environment variables for Tiingo");
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
  await dailyCacheService.initializeCache();
  console.timeEnd("Daily Cache Service Initialization");

  container
    .bind<OverviewService>(TYPES.OverviewService)
    .to(OverviewService)
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
