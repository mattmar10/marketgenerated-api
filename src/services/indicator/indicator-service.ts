import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { SymbolService } from "../symbol/symbol_service";
import { Candle } from "../../modles/candle";
import { DailyCacheService } from "../daily_cache_service";
import { AtrResult, atr } from "../../indicators/atr";
import { symbol } from "zod";

@injectable()
export class IndicatorsService {
  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService
  ) {}

  public atr(ticker: string, period: number): AtrResult {
    const candles = this.cacheSvc.getCandles(ticker);
    return atr(candles, period);
  }
}
