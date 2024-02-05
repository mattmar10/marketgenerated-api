import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { Candle } from "../../modles/candle";
import { DailyCacheService } from "../daily_cache_service";
import {
  Either,
  Left,
  Right,
  Ticker,
  isLeft,
  isRight,
} from "../../MarketGeneratedTypes";
import { BetaWithAlpha, getBeta } from "../../indicators/beta";

import { slidingWindow, sortCandlesByDate } from "../../utils/basic_utils";
import { BetaLinePoint } from "../../indicators/linep-point-types";

export type IndicatorError = {
  message: string;
};

export interface BetaResult {
  timeseries: BetaLinePoint[];
}

@injectable()
export class IndicatorsService {
  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService
  ) {}

  public beta(
    ticker: Ticker,
    periodInDays: number
  ): Either<IndicatorError, BetaWithAlpha> {
    const candles = this.cacheSvc.getCandles(ticker);
    const benchMarkCandles = this.cacheSvc.getCandles("SPY");

    const date = new Date();
    date.setDate(date.getDate() - periodInDays);

    const filteredCandles = candles.filter((c) => c.date > date.getTime());

    const sorted = sortCandlesByDate(filteredCandles);

    if (filteredCandles.length >= 0) {
      const filteredBenchMark: Candle[] = [];
      const sanitizedCandles: Candle[] = [];
      sorted.forEach((c) => {
        const benchmark = benchMarkCandles.find((b) => b.dateStr === c.dateStr);
        if (benchmark) {
          filteredBenchMark.push(benchmark);
          sanitizedCandles.push(c);
        }
      });

      const betaValue = getBeta(sanitizedCandles, filteredBenchMark);

      if (isLeft(betaValue)) {
        return Left({
          message: `${betaValue.tag}}`,
        });
      }

      return betaValue;
    } else {
      return Left({
        message: `Not enough data to calculate beta for ${ticker} - only ${filteredCandles.length}`,
      });
    }
  }

  public betaSequence(
    ticker: Ticker,
    startDate: Date,
    periodInDays: number
  ): Either<IndicatorError, BetaResult> {
    const candles = this.cacheSvc.getCandles(ticker);
    const benchMarkCandles = this.cacheSvc.getCandles("SPY");

    startDate.setDate(startDate.getDate() - periodInDays);

    const filteredCandles = candles.filter((c) => c.date > startDate.getTime());

    if (!filteredCandles || filteredCandles.length < periodInDays) {
      return Left({
        message: `Unable to calculate beta sequence for ${ticker}. Not enough data`,
      });
    }

    const sorted = filteredCandles.sort((a, b) => a.date - b.date);
    const windows = slidingWindow<Candle>(sorted, periodInDays);

    const timeSeries: BetaLinePoint[] = [];
    windows.forEach((stockCandles) => {
      const tickerCandles: Candle[] = [];
      const baseline: Candle[] = [];

      stockCandles.forEach((c) => {
        const benchMark = benchMarkCandles.find((b) => b.dateStr === c.dateStr);

        if (benchMark) {
          tickerCandles.push(c);
          baseline.push(benchMark);
        }
      });

      const betaForWindow = getBeta(tickerCandles, baseline);

      if (isRight(betaForWindow)) {
        const betaPoint: BetaLinePoint = {
          time: baseline[baseline.length - 1].dateStr!,
          beta: betaForWindow.value.beta,
          alpha: betaForWindow.value.alpha,
        };

        timeSeries.push(betaPoint);
      }
    });

    const result: BetaResult = {
      timeseries: timeSeries,
    };

    return Right(result);
  }
}
