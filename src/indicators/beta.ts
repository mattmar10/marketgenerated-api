import { Either, Left, Right, isLeft, match } from "../MarketGeneratedTypes";
import { DailyReturn } from "../controllers/daily/daily-responses";
import { Candle } from "../modles/candle";
import { formatDateFromMillisecondsToEST } from "../utils/epoch_utils";
import { MathError, covariance, variance } from "../utils/math_utils";
import { LinePoint } from "./linep-point-types";

export type BetaWithAlpha = {
  beta: number;
  alpha: number;
};

export function getBeta(
  candles: Candle[],
  benchMarkCandles: Candle[]
): Either<MathError, BetaWithAlpha> {
  const benchmarkReturns = calculateDailyReturnsSeq(benchMarkCandles);
  const candleReturns = calculateDailyReturnsSeq(candles);

  return calculateBeta(benchmarkReturns, candleReturns);
}

const calculateBeta = (
  benchmarkReturns: number[],
  stockReturns: number[]
): Either<MathError, BetaWithAlpha> => {
  const cov: Either<MathError, number> = covariance(
    stockReturns,
    benchmarkReturns
  );

  if (isLeft(cov)) {
    return Left(cov.value);
  }
  const varB: number = variance(benchmarkReturns);
  const betaVal: number = cov.value / varB;

  const lastStockReturn = stockReturns[stockReturns.length - 1];
  const lastBenchMarkReturn = benchmarkReturns[benchmarkReturns.length - 1];

  //alpha is given by Alpha=Actual Return− (β × Expected Market Return)
  const alpha = lastStockReturn - betaVal * lastBenchMarkReturn;

  return Right({
    beta: Number(betaVal.toFixed(2)),
    alpha: Number(alpha.toFixed(2)),
  });
};

function calculateDailyReturnsSeq(candles: Candle[]): number[] {
  const companyReturns: number[] = candles
    //.sort((a, b) => a.date - b.date)
    .map((candle, index, candles) => {
      if (index === 0) return null; // Skip the first element as there's no previous one
      const returns =
        (candle.close - candles[index - 1].close) / candles[index - 1].close;
      return Number((returns * 100).toFixed(2));
    })
    .filter((returnObj) => returnObj !== null) as number[];

  return companyReturns;
}
