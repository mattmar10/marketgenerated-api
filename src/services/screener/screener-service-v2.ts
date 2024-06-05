import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { DailyCacheService } from "../daily_cache_service";

import {
  Either,
  Left,
  Right,
  Ticker,
  isLeft,
  match,
} from "../../MarketGeneratedTypes";
import { Candle } from "../../modles/candle";
import { SymbolService } from "../symbol/symbol_service";
import { RelativeStrengthService } from "../relative-strength/relative-strength-service";
import { filterCandlesPast52Weeks } from "../../indicators/indicator-utils";
import {
  adrPercent,
  findMean,
  isADRPercentError,
} from "../../indicators/adr-percent";

export type ExtractorError = string;

@injectable()
export class ScreenerServiceV2 {
  private basicExtractors: Record<
    string,
    (ticker: Ticker) => Either<ExtractorError, number>
  >;

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService,
    @inject(TYPES.RelativeStrengthService)
    private relativeStrengthSvc: RelativeStrengthService
  ) {
    this.basicExtractors = {
      price: (ticker: Ticker) => {
        const candles = this.cacheSvc.getCandles(ticker);

        if (candles && candles.length > 0) {
          const filtered = filterCandlesPast52Weeks(candles);
          return Right(filtered[filtered.length - 1].close);
        } else {
          return Left("Not enough candles");
        }
      },
      volume: (ticker: Ticker) => {
        const candles = this.cacheSvc.getCandles(ticker);
        if (candles && candles.length > 0) {
          const filtered = filterCandlesPast52Weeks(candles);
          return Right(filtered[filtered.length - 1].volume);
        } else {
          return Left("Not enough candles");
        }
      },
      avgVolume: (ticker: Ticker) => {
        const candles = this.cacheSvc.getCandles(ticker);
        if (candles && candles.length > 50) {
          const filtered = filterCandlesPast52Weeks(candles);
          const last = filtered.slice(-50).map((c) => c.volume);
          return Right(findMean(last));
        } else {
          return Left("Not enough candles to calculate avgVolume");
        }
      },
      adrPercent: (ticker: Ticker) => {
        const candles = this.cacheSvc.getCandles(ticker);
        if (candles && candles.length > 20) {
          const filtered = filterCandlesPast52Weeks(candles);
          const adr = adrPercent(filtered, 20);
          if (isADRPercentError(adr)) {
            return Left(`Error calculating ADR ${adr}`);
          }
          return Right(adr);
        } else {
          return Left("Not enough candles");
        }
      },
    };
  }
}
