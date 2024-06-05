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
  match,
} from "../../MarketGeneratedTypes";
import { BetaWithAlpha, getBeta } from "../../indicators/beta";

import { slidingWindow, sortCandlesByDate } from "../../utils/basic_utils";
import {
  AVWAPE,
  AVWapLinePoint,
  BetaLinePoint,
  LinePoint,
} from "../../indicators/linep-point-types";
import axios from "axios";
import { CandleListSchema, FMPCandle } from "../financial_modeling_prep_types";
import {
  calculatePopulationStandardDeviation,
  isMathError,
} from "../../utils/math_utils";
import { formatDateToEST } from "../../utils/epoch_utils";
import {
  calculateLinearRegression,
  calculateLinearRegressionFromNumbers,
  isLinearRegressionResult,
} from "../../indicators/linear-regression";
import { filterCandlesPast52Weeks } from "../../indicators/indicator-utils";
import { atr } from "../../indicators/atr";

export type IndicatorError = {
  message: string;
};

export interface BetaResult {
  timeseries: BetaLinePoint[];
}

@injectable()
export class IndicatorsService {
  private FINANCIAL_MODELING_PREP_URL =
    "https://financialmodelingprep.com/api/v3";
  private financialModelingPrepKey = process.env.FINANCIAL_MODELING_PREP_KEY;
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
        const candle = tickerCandles[tickerCandles.length - 1];
        const benchmark = baseline[baseline.length - 1];
        const rsRatio = candle.close / benchmark.close;

        const adjClose =
          candle.close + candle.close * betaForWindow.value.alpha;
        const adjRatio = adjClose / benchmark.close;

        const betaPoint: BetaLinePoint = {
          time: baseline[baseline.length - 1].dateStr!,
          beta: betaForWindow.value.beta,
          alpha: betaForWindow.value.alpha,
          rsLineRatio: Number(rsRatio.toFixed(2)),
          adustedRsLineRatio: Number(adjRatio.toFixed(2)),
        };

        timeSeries.push(betaPoint);
      }
    });

    const result: BetaResult = {
      timeseries: timeSeries,
    };

    return Right(result);
  }

  public anchoredVWAP(
    ticker: Ticker,
    startDate: string
  ): Either<IndicatorError, AVWapLinePoint[]> {
    const candles = this.cacheSvc.getCandles(ticker);

    const date = new Date(startDate);
    date.setDate(date.getDate() - 1);

    const filteredCandles = candles.filter(
      (c) => c.date >= new Date(date).getTime()
    );

    const vwapEPoints: AVWapLinePoint[] = [];
    let totalVolume = 0;
    let totalPrice = 0;

    for (let i = 0; i < filteredCandles.length; i++) {
      const candle = filteredCandles[i];
      const index = candles.findIndex((c) => c.dateStr === candle.dateStr);
      const startIndex = Math.max(0, index - 19); // Calculate the start index for the slice, ensuring it doesn't go below 0
      const endIndex = index + 1; // Calculate the end index for the slice, adding 1 to include the candle at the specified index

      const last20Candles = candles.slice(startIndex, endIndex);
      const closes = last20Candles.map((c) => c.close);
      const stdDev = calculatePopulationStandardDeviation(closes);

      const avgPrice =
        (candle.open + candle.high + candle.low + candle.close) / 4;
      totalVolume += candle.volume;
      totalPrice += candle.volume * avgPrice;

      const anchoredVWAP = totalPrice / totalVolume;

      const stdD = isMathError(stdDev) ? 0 : stdDev;

      // Create a LineChartPoint object and push it into the vwapEPoints array
      vwapEPoints.push({
        time: candle.dateStr!,
        value: Number(anchoredVWAP.toFixed(2)),
        standardDeviation: Number(stdD.toFixed(2)),
      });
    }

    return Right(vwapEPoints);
  }

  public anchoredVWAPE(ticker: Ticker): Either<IndicatorError, AVWAPE[]> {
    const earningsCalendar = this.cacheSvc.getEarningsCalendar(ticker);
    if (earningsCalendar) {
      const filteredEarnings = earningsCalendar.filter((e) => e.eps != null);

      filteredEarnings.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const results: AVWAPE[] = [];
      if (filteredEarnings.length > 0) {
        const lastEarnings = filteredEarnings[filteredEarnings.length - 1];
        const date = new Date(lastEarnings.date);

        if (lastEarnings.time == "amc") {
          date.setDate(date.getDate() + 2);
        } else {
          date.setDate(date.getDate() + 1);
        }

        const avap = this.anchoredVWAP(ticker, formatDateToEST(date));
        match(
          avap,
          (err) => console.error(err),
          (avwapE) =>
            results.push({
              earningsDate: formatDateToEST(date),
              timeSeries: avwapE,
            })
        );
      }

      if (filteredEarnings.length > 1) {
        const lastEarnings = filteredEarnings[filteredEarnings.length - 2];
        const date = new Date(lastEarnings.date);

        if (lastEarnings.time == "amc") {
          date.setDate(date.getDate() + 1);
        } else {
          date.setDate(date.getDate() + 1);
        }

        const avap = this.anchoredVWAP(ticker, formatDateToEST(date));
        match(
          avap,
          (err) => console.error(err),
          (avwapE) =>
            results.push({
              earningsDate: formatDateToEST(date),
              timeSeries: avwapE,
            })
        );
      }
      return Right(results);
    } else {
      return Left({
        message: "No earnings data",
      });
    }
  }

  public expSlope(
    candles: Candle[],
    period: number
  ): Either<IndicatorError, number> {
    if (!candles || candles.length < period) {
      return Left({ message: "Not enough candles for eslope" });
    }
    const filtered = filterCandlesPast52Weeks(candles);

    if (filtered.length < period) {
      return Left({
        message: "Not enough candles after filtering for 52 weeks",
      });
    }

    const lastCandles = filtered.slice(-period);
    const mapped = lastCandles.map((c) => Math.log(c.close));
    const linearReg = calculateLinearRegressionFromNumbers(
      mapped,
      mapped.length
    );

    if (!isLinearRegressionResult(linearReg)) {
      return Left({ message: "error calculating linear regression" });
    }

    const raised = Math.pow(linearReg.slope, 252);
    const result = (raised - 1) * 100;

    return Right(result);
  }

  public expSlopeSeq(
    candles: Candle[],
    period: number
  ): Either<IndicatorError, LinePoint[]> {
    if (!candles || candles.length < period) {
      return Left({ message: "Not enough candles for eslope" });
    }
    const filtered = filterCandlesPast52Weeks(candles);

    if (filtered.length < period) {
      return Left({
        message: "Not enough candles after filtering for 52 weeks",
      });
    }

    const timeseries: LinePoint[] = [];

    for (let i = period; i <= filtered.length; i++) {
      const periodCandles = filtered.slice(i - period, i);
      const mapped = periodCandles.map((c) => Math.log(c.close));
      const linearReg = calculateLinearRegressionFromNumbers(
        mapped,
        mapped.length
      );

      if (!isLinearRegressionResult(linearReg)) {
        return Left({ message: "error calculating linear regression" });
      }

      const annualizedSlope = Math.pow(Math.exp(linearReg.slope), 252);
      const result = (annualizedSlope - 1) * 100;

      timeseries.push({
        time: periodCandles[periodCandles.length - 1].dateStr!,
        value: result,
      });
    }

    return Right(timeseries);
  }

  public normalizedROC(candles: Candle[], lookback: number, atrPeriod: number) {
    if (!candles || candles.length < lookback || candles.length < atrPeriod) {
      return Left({ message: "Not enough candles for eslope" });
    }

    if (lookback < atrPeriod) {
      return Left({ message: "lookback must be greater than atrPeriod" });
    }

    const filtered = filterCandlesPast52Weeks(candles);

    const lastCandles = filtered.slice(-lookback);
    const rise =
      lastCandles[lastCandles.length - 1].close - lastCandles[0].close;
    const roc = rise / lookback;

    const atrResult = atr(lastCandles, atrPeriod);
    const lastPoint = atrResult.timeseries[atrResult.timeseries.length - 1];

    return Right(roc / lastPoint.value);
  }

  public normalizedROCSeq(
    candles: Candle[],
    lookback: number,
    atrPeriod: number
  ): Either<{ message: string }, LinePoint[]> {
    if (!candles || candles.length < lookback || candles.length < atrPeriod) {
      return Left({ message: "Not enough candles for eslope" });
    }

    if (lookback < atrPeriod) {
      return Left({ message: "lookback must be greater than atrPeriod" });
    }

    const filtered = filterCandlesPast52Weeks(candles);

    if (filtered.length < lookback || filtered.length < atrPeriod) {
      return Left({
        message: "Not enough candles after filtering for 52 weeks",
      });
    }

    const timeseries: LinePoint[] = [];

    for (let i = lookback; i <= filtered.length; i++) {
      const periodCandles = filtered.slice(i - lookback, i);
      const rise =
        periodCandles[periodCandles.length - 1].close - periodCandles[0].close;
      const roc = rise / lookback;

      const atrResult = atr(periodCandles, atrPeriod);
      const lastPoint = atrResult.timeseries[atrResult.timeseries.length - 1];

      const normalizedROCValue = roc / lastPoint.value;

      timeseries.push({
        time: periodCandles[periodCandles.length - 1].dateStr!,
        value: normalizedROCValue,
      });
    }

    return Right(timeseries);
  }
}
