const TYPES = {
  DailyCacheService: Symbol.for("com.marketgenerated.api.DailyCacheSvc"),
  OverviewService: Symbol.for("com.marketgenerated.api.OverviewService"),
  PriceHistoryService: Symbol.for("com.marketgenerated.api.PriceHistorySvc"),
  S3Client: Symbol.for("com.marketgenerated.api.s3.client"),
  SymbolService: Symbol.for("com.marketgenerated.api.SymbolService"),
};

export default TYPES;
