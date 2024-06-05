import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { DailyCacheService } from "../daily_cache_service";
import { SymbolService } from "../symbol/symbol_service";
import { MarketBreadthService } from "../breadth/market-breadth-service";
import {
  IndicatorError,
  filterCandlesPast52Weeks,
} from "../../indicators/indicator-utils";
import { IndicatorsService } from "../indicator/indicator-service";
import {
  adrPercent,
  adrPercentSeq,
  isADRPercentError,
} from "../../indicators/adr-percent";
import { Ticker, isRight } from "../../MarketGeneratedTypes";

type RotationalStrategyPoint = {
  dateStr: string;
  adrP: number;
  expSlopeShort: number;
  expSlopeLong: number;
  normalizedRoc: number;
};

type RotationalStrategyLine = {
  ticker: Ticker;
  timeSeries: RotationalStrategyPoint[];
};

@injectable()
export class RotationalStrategy {
  private rspRotationalMap: Map<string, RotationalStrategyPoint[]> = new Map();

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService,
    @inject(TYPES.MarketBreadthService)
    private marketBreadthSvc: MarketBreadthService,
    @inject(TYPES.IndicatorService) private indicatorSvc: IndicatorsService
  ) {}

  public initializeSP500RotationalStrategy() {
    const symbols = this.marketBreadthSvc.getRSPHoldings();

    symbols.forEach((ticker, i) => {
      const profile = this.symbolSvc
        .getStocks()
        .find((s) => s.Symbol === ticker);

      if (
        profile &&
        profile.sector &&
        profile.sector !== "Financial Services"
      ) {
        const candles = this.cacheSvc.getCandles(ticker);
        const filtered = filterCandlesPast52Weeks(candles);

        const eSlopeShort = this.indicatorSvc.expSlopeSeq(filtered, 60);
        const eSlopeLong = this.indicatorSvc.expSlopeSeq(filtered, 120);
        const normalizedROC = this.indicatorSvc.normalizedROCSeq(
          candles,
          200,
          20
        );
        const adrP = adrPercentSeq(filtered, 20);

        if (
          isRight(eSlopeShort) &&
          isRight(eSlopeLong) &&
          isRight(normalizedROC) &&
          !isADRPercentError(adrP)
        ) {
          const timeSeries: RotationalStrategyPoint[] = [];

          eSlopeShort.value.forEach((e) => {
            const adrPVal = adrP.find((a) => a.time === e.time)?.value;
            const eSlopeLongValue = eSlopeLong.value.find(
              (l) => l.time === e.time
            )?.value;
            const normalizedROCValue = normalizedROC.value.find(
              (n) => n.time === e.time
            )?.value;

            if (adrPVal && eSlopeLongValue && normalizedROCValue) {
              const point: RotationalStrategyPoint = {
                dateStr: e.time,
                adrP: adrPVal,
                expSlopeShort: e.value,
                expSlopeLong: eSlopeLongValue,
                normalizedRoc: normalizedROCValue,
              };
              timeSeries.push(point);
            }
          });

          this.rspRotationalMap.set(ticker, timeSeries);
        }
      }
    });
  }

  public getSP500RotationalValues() {
    const results: RotationalStrategyLine[] = [];
    this.rspRotationalMap.forEach((line, ticker) => {
      const last = line[line.length - 1];

      if (
        last.expSlopeLong > 0 &&
        last.expSlopeShort > 0 &&
        last.adrP > 2 &&
        last.adrP < 5
      ) {
        results.push({
          ticker: ticker,
          timeSeries: line.slice(-10),
        });
      }
    });
    return results.slice().sort((a, b) => {
      const aLastPoint = a.timeSeries[a.timeSeries.length - 1];
      const bLastPoint = b.timeSeries[b.timeSeries.length - 1];

      // Ensure both timeSeries are not empty
      if (!aLastPoint || !bLastPoint) {
        throw new Error("timeSeries must not be empty");
      }

      return aLastPoint.normalizedRoc - bLastPoint.normalizedRoc;
    });
  }
}
