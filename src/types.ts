const TYPES = {
  DailyCacheService: Symbol.for("com.marketgenerated.api.DailyCacheSvc"),
  OverviewService: Symbol.for("com.marketgenerated.api.OverviewService"),
  PriceHistoryService: Symbol.for("com.marketgenerated.api.PriceHistorySvc"),
  S3Client: Symbol.for("com.marketgenerated.api.s3.client"),
  ScreenerService: Symbol.for("com.marketgenerated.api.ScreenerService"),
  SearchService: Symbol.for("com.marketgenerated.api.SearchService"),
  SymbolService: Symbol.for("com.marketgenerated.api.SymbolService"),
};

export default TYPES;
