import { MarketBreadthService } from "./services/breadth/market-breadth-service";
import { RealtimeQuoteService } from "./services/realtime-quote-service";

const TYPES = {
  DailyCacheService: Symbol.for("com.marketgenerated.api.DailyCacheSvc"),
  IndicatorService: Symbol.for("com.marketgenerated.api.IndicatorService"),
  LevelsService: Symbol.for("com.marketgenerated.api.LevelsService"),
  MarketBreadthService: Symbol.for(
    "com.marketgenerated.api.MarketBreadthService"
  ),
  OverviewService: Symbol.for("com.marketgenerated.api.OverviewService"),
  PriceHistoryService: Symbol.for("com.marketgenerated.api.PriceHistorySvc"),
  PGClient: Symbol.for("com.marketgenerated.api.pg.client"),
  PGPool: Symbol.for("com.marketgenerated.api.pg.pool"),
  RealtimeQuoteService: Symbol.for(
    "com.marketgenerated.api.RealtimeQuoteService"
  ),
  RelativeStrengthService: Symbol.for(
    "com.markgetgenerated.api.RelativeStrengthService"
  ),
  RotationalStrategy: Symbol.for(
    "com.markgetgenerated.api.stategy.RotationalStrategy"
  ),
  S3Client: Symbol.for("com.marketgenerated.api.s3.client"),
  ScreenerService: Symbol.for("com.marketgenerated.api.ScreenerService"),
  ScanService: Symbol.for("com.marketgenerated.api.ScanService"),
  ScanRepository: Symbol.for("com.marketgenerated.api.ScanRepository"),
  SearchService: Symbol.for("com.marketgenerated.api.SearchService"),
  StockIndexService: Symbol.for("com.marketgenerated.api.StockIndexService"),
  SymbolService: Symbol.for("com.marketgenerated.api.SymbolService"),
  FundamentalRelativeStrengthService: Symbol.for(
    "com.marketgenerated.api.FundamentalRelativeStrengthService"
  ),
  VolumeSurgeService: Symbol.for("com.marketgenerated.api.VolumeSurgeService"),
};

export default TYPES;
