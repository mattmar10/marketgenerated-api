import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { DailyCacheService } from "../daily_cache_service";
import { Either, Left, Right, Ticker, match } from "../../MarketGeneratedTypes";
import {
  calculateMean,
  calculatePopulationStandardDeviation,
  isMathError,
} from "../../utils/math_utils";
import {
  CandleWithVolatilityData,
  VolatilityData as VolatilityData,
} from "./levels-types";
import { SymbolService } from "../symbol/symbol_service";
import { Candle } from "../../modles/candle";

export type LevelsError = string;

@injectable()
export class LevelsService {
  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService
  ) {}

  public calculateVolatilityLevels(
    symbol: Ticker,
    period: number = 14,
    candles: Candle[],
    meanValue: number | undefined
  ): Either<LevelsError, VolatilityData> {
    if (!candles || candles.length < period) {
      return Left("Not enough data to calculate volatility levels");
    } else {
      const filtered = candles.slice(-period);
      const ranges = filtered.map((c) => c.high - c.low);

      console.log(
        `Calculating volatility levels for ${symbol} from ${ranges} `
      );

      const mean = calculateMean(ranges);
      const stdDev = calculatePopulationStandardDeviation(ranges);

      if (mean && !isMathError(stdDev)) {
        const volatilityData: VolatilityData = {
          period: period,
          standardDeviation: Number(stdDev.toFixed(2)),
          avgRange: Number(mean.toFixed(2)),
          mean: meanValue,
        };

        return Right(volatilityData);
      } else {
        console.error(`Unable to calculate mean for ${symbol}`);
        return Left("Unable to calculate volatility levels");
      }
    }
  }

  public calculateAllVolatilityLevels(
    symbol: Ticker,
    period: number,
    candles: Candle[]
  ): Either<LevelsError, CandleWithVolatilityData[]> {
    const result: CandleWithVolatilityData[] = [];

    for (let i = period; i < candles.length; i++) {
      const meanValue = candles[i].open;
      const slice = candles.slice(i - period, i);
      const volatilityResult = this.calculateVolatilityLevels(
        symbol,
        period,
        slice,
        meanValue
      );

      match(
        volatilityResult,
        (error) => {
          console.error(`Error calculating volatility levels: ${error}`);
        },
        (volatilityData) => {
          const candleWithVolatility: CandleWithVolatilityData = {
            date: candles[i].dateStr as string,
            volatilityData: volatilityData,
          };
          result.push(candleWithVolatility);
        }
      );
    }

    return Right(result);
  }
}
