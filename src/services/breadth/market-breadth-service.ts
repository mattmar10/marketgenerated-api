import { inject, injectable } from "inversify";
import TYPES from "../../types";
import { DailyCacheService } from "../daily_cache_service";
import { SymbolService } from "../symbol/symbol_service";
import { Candle } from "../../modles/candle";
import {
  AdvanceDeclineDataPoint,
  AdvanceDeclineOverview,
  ETFSnapshot,
  FiftyTwoWeekHighsLowsDataPoint,
  GeneralMarkeOverview,
  MarketBreadthOverview,
  MarketBreadthPoint,
  McClellanOscillator,
  McClellanOscillatorPoint,
  PercentAboveMAPoint,
  PercentAboveSMALine,
  UpDownDataPoint,
  DateCount,
  MarketReturnsDataPoint,
  CurrentDayMarketBreadthSnapshot,
  CurrentDayMarketBreadthSnapshotPoint,
  SectorCurrentDayMarketBreadthSnapshot,
  DailyMarketBreadthPoint,
  NewMarketBreadthPoint,
  NewMarketBreadthOverview,
  GlobalDailyBreadthDataPoint,
} from "../../controllers/overview/overview-responses";
import {
  MovingAverageError,
  calculateSMA,
  ema,
  isMovingAverageError,
  sma,
  smaSeq,
} from "../../indicators/moving-average";
import { Ticker } from "../../MarketGeneratedTypes";
import { FMPSymbolProfileData } from "../financial_modeling_prep_types";
import { DataError, isDataError } from "../data_error";
import {
  filterCandlesPast52Weeks,
  filterCandlesPastWeeks,
} from "../../indicators/indicator-utils";
import { RealtimeQuoteService } from "../realtime-quote-service";
import { formatDateFromMillisecondsToEST } from "../../utils/epoch_utils";
import { Quote } from "../symbol/symbol-types";
import { calculateMean, calculateMedian } from "../../utils/math_utils";
import { findMean } from "../../indicators/adr-percent";

const sectorsNameMap: Map<string, string> = new Map([
  ["utilities", "UTILITIES"],
  ["consumer-defensive", "CONSUMER DEFENSIVE"],
  ["real-estate", "REAL ESTATE"],
  ["industrials", "INDUSTRIALS"],
  ["basic-materials", "BASIC MATERIALS"],
  ["healthcare", "HEALTHCARE"],
  ["consumer-cyclical", "CONSUMER CYCLICAL"],
  ["technology", "TECHNOLOGY"],
  ["financial-services", "FINANCIAL SERVICES"],
  ["energy", "ENERGY"],
  ["communication-services", "COMMUNICATION SERVICES"],
]);

@injectable()
export class MarketBreadthService {
  private marketBreadthOverview: NewMarketBreadthOverview;
  private nyseMarketBreadthOverview: NewMarketBreadthOverview;
  private nasdaqMarketBreadthOverview: NewMarketBreadthOverview;
  private sectorBreadthOverview: Map<string, NewMarketBreadthOverview> =
    new Map();
  private generalMarketOverview: GeneralMarkeOverview;
  private stocks: Set<string> = new Set<string>();

  private tickerDailyData: Map<Ticker, DailyMarketBreadthPoint[]> = new Map();
  private tradingDates: string[] = [];

  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService,
    @inject(TYPES.RealtimeQuoteService)
    private realtimQuoteService: RealtimeQuoteService
  ) {
    console.log("building market overview");
    this.generalMarketOverview = {
      rspSnapshot: this.buildETFSnapshot("RSP"),
      spySnapshot: this.buildETFSnapshot("SPY"),
      qqqeSnapshot: this.buildETFSnapshot("QQQE"),
      qqqSnapshot: this.buildETFSnapshot("QQQ"),
      percentOfSuccesfulTenDayHighs:
        this.getPercentOfSuccessfulHighsTenDaysAgo(),
    };
    this.buildDailyTickerData();
    this.marketBreadthOverview = this.buildMarketBreadthFromDailyTickerData();
    this.nasdaqMarketBreadthOverview =
      this.buildMarketBreadthFromDailyTickerData(
        (s) => s.exchangeShortName === "NASDAQ"
      );
    this.nyseMarketBreadthOverview = this.buildMarketBreadthFromDailyTickerData(
      (s) => s.exchangeShortName === "NYSE"
    );
    //this.marketBreadthOverview = this.buildMarketBreadth();
    //this.nyseMarketBreadthOverview = this.buildMarketBreadth(
    //  (s) => s.exchangeShortName === "NYSE"
    //);
    // this.nasdaqMarketBreadthOverview = this.buildMarketBreadth(
    //  (s) => s.exchangeShortName === "NASDAQ"
    // );

    this.buildSectorBreadth();
    console.log("finished building market overview");
  }

  private buildSectorBreadth() {
    console.log("building sector breadth");
    const stocks = this.symbolSvc.getStocks();
    const uniqueSectors = new Set(
      stocks
        .map((s) => s.sector) // Extract sectors
        .filter((sector) => sector !== undefined && sector !== null) // Filter out undefined sectors
    );

    const uniqueSectorsArray = Array.from(uniqueSectors);

    for (const sector of uniqueSectorsArray) {
      if (sector) {
        // const sectorBreadth = this.buildMarketBreadth(
        //   (s) => s.sector === sector
        // );
        const sectorBreadthFromTickerData =
          this.buildMarketBreadthFromDailyTickerData(
            (s) => s.sector === sector
          );
        this.sectorBreadthOverview.set(
          sector.toLowerCase().replace(/ /g, "-"),
          sectorBreadthFromTickerData
        );
      }
    }
  }

  private buildETFSnapshot(
    benchMarkTicker: Ticker
  ): ETFSnapshot | MovingAverageError[] {
    console.log("calculating SMA for RSP an QQE");
    const candles = filterCandlesPast52Weeks(
      this.cacheSvc.getCandles(benchMarkTicker)
    );

    const closes = candles.map((c) => c.close);
    const fiveSMA = sma(5, closes);
    const tenEMA = ema(10, closes);
    const twentyOneEMA = ema(21, closes);
    const fiftySMA = sma(50, closes);
    const twoHundredSMA = sma(200, closes);

    const errors: MovingAverageError[] = [];

    if (isMovingAverageError(fiveSMA)) {
      errors.push(fiveSMA);
    }

    if (isMovingAverageError(tenEMA)) {
      errors.push(tenEMA);
    }

    if (isMovingAverageError(twentyOneEMA)) {
      errors.push(twentyOneEMA);
    }

    if (isMovingAverageError(fiftySMA)) {
      errors.push(fiftySMA);
    }

    if (isMovingAverageError(twoHundredSMA)) {
      errors.push(twoHundredSMA);
    }

    if (errors.length > 0) {
      console.error("Error calculating MAs for Equal Weighted ETFs");
      return errors;
    } else {
      return {
        lastPrice: closes[closes.length - 1],
        fiveSMA: fiveSMA as number,
        tenEMA: tenEMA as number,
        twentyOneEMA: twentyOneEMA as number,
        fiftySMA: fiftySMA as number,
        twoHundredSMA: twoHundredSMA as number,
      };
    }
  }

  private buildMarketBreadth(
    fitlerFn: (symbol: FMPSymbolProfileData) => boolean = (_) => true
  ): MarketBreadthOverview {
    const currentDate = new Date();

    // Calculate the date 2 years and one day ago
    const twoYearsOneDayAgo = new Date(
      currentDate.getFullYear() - 2,
      currentDate.getMonth(),
      currentDate.getDate() - 1,
      currentDate.getHours(),
      currentDate.getMinutes(),
      currentDate.getSeconds(),
      currentDate.getMilliseconds()
    );

    // Get the time in milliseconds
    const startMillis = twoYearsOneDayAgo.getTime();
    const endMillis = currentDate.getTime();

    console.log("Building market breadth");

    const stocks = this.symbolSvc.getStocks();
    const filtered = stocks.filter((s) => fitlerFn(s));
    const universeOfStockKeys = filtered.map((s) => s.Symbol);

    const data: Map<string, MarketBreadthPoint> = new Map();

    const windowSize = 252;
    let count = 0;

    for (const c of universeOfStockKeys) {
      const candles: Candle[] = this.cacheSvc.getCandles(c);
      const filteredCandles = candles.filter(
        (c) => c.date >= startMillis && c.date <= endMillis
      );

      if (filteredCandles.length < 252) {
        continue;
      }

      count = count + 1;
      this.stocks.add(c);
      const sorted = [...filteredCandles].sort((a, b) => {
        if (a.date > b.date) {
          return 1;
        } else if (a.date < b.date) {
          return -1;
        }
        return 0;
      });

      for (let i = 60; i < sorted.length; i++) {
        const candle = sorted[i];
        const prevCandle = sorted[i - 1];

        const oneMonthAgoCandle = sorted[i - 20];
        const threeMonthsAgoCandle = sorted[i - 60];

        const percentReturn =
          100 * ((candle.close - prevCandle.close) / prevCandle.close);

        const oneMonthPercentReturn =
          100 *
          ((candle.close - oneMonthAgoCandle.close) / oneMonthAgoCandle.close);
        const threeMonthPercentReturn =
          100 *
          ((candle.close - threeMonthsAgoCandle.close) /
            threeMonthsAgoCandle.close);

        const isAdvancing = candle.close > prevCandle.close;
        const isDeclining = candle.close < prevCandle.close;
        const aboveFourPercent = percentReturn > 4;
        const declineFourPercent = percentReturn < -4;
        const oneMontAboveTwentyFivePercent = oneMonthPercentReturn > 25;
        const oneMonthDeclineAboveTwentyFivePercent =
          oneMonthPercentReturn < -25;
        const threeMontAboveTwentyFivePercent = threeMonthPercentReturn > 25;
        const threeMonthDeclineAboveTwentyFivePercent =
          threeMonthPercentReturn < -25;

        let newHigh = false;
        let newLow = false;
        if (i >= windowSize) {
          const windowCandles = sorted.slice(i - windowSize + 1, i + 1);
          const fiftyTwoWeekHigh = Math.max(
            ...windowCandles.map((c) => c.high)
          );
          const fiftyTwoWeekLow = Math.min(...windowCandles.map((c) => c.low));

          if (fiftyTwoWeekHigh == candle.high) {
            newHigh = true;
          }

          if (fiftyTwoWeekLow == candle.low) {
            newLow = true;
          }
        }

        const previousValue = data.get(candle.dateStr!);
        if (previousValue) {
          const valueToSet: MarketBreadthPoint = {
            dateStr: previousValue.dateStr,
            advances: isAdvancing
              ? previousValue.advances + 1
              : previousValue.advances,
            declines: isDeclining
              ? previousValue.declines + 1
              : previousValue.declines,
            upVolume: isAdvancing
              ? previousValue.upVolume + candle.volume * candle.close
              : previousValue.upVolume,
            downVolume: isDeclining
              ? previousValue.downVolume + candle.volume * candle.close
              : previousValue.downVolume,
            fiftyTwoWeekHighs: newHigh
              ? previousValue.fiftyTwoWeekHighs
                ? previousValue.fiftyTwoWeekHighs + 1
                : 1
              : previousValue.fiftyTwoWeekHighs,
            fiftyTwoWeekLows: newLow
              ? previousValue.fiftyTwoWeekLows
                ? previousValue.fiftyTwoWeekLows + 1
                : 1
              : previousValue.fiftyTwoWeekLows,
            fourPercentAdvancers: aboveFourPercent
              ? previousValue.fourPercentAdvancers + 1
              : previousValue.fourPercentAdvancers,
            fourPercentDecliners: declineFourPercent
              ? previousValue.fourPercentDecliners + 1
              : previousValue.fourPercentDecliners,
            oneMonthTwentyFivePercentAdvancers: oneMontAboveTwentyFivePercent
              ? previousValue.oneMonthTwentyFivePercentAdvancers + 1
              : previousValue.oneMonthTwentyFivePercentAdvancers,
            oneMonthTwentyFivePercentDecliners:
              oneMonthDeclineAboveTwentyFivePercent
                ? previousValue.oneMonthTwentyFivePercentDecliners + 1
                : previousValue.oneMonthTwentyFivePercentDecliners,
            threeMonthTwentyFivePercentAdvancers:
              threeMontAboveTwentyFivePercent
                ? previousValue.threeMonthTwentyFivePercentAdvancers + 1
                : previousValue.threeMonthTwentyFivePercentAdvancers,
            threeMonthTwentyFivePercentDecliners:
              threeMonthDeclineAboveTwentyFivePercent
                ? previousValue.threeMonthTwentyFivePercentDecliners + 1
                : previousValue.threeMonthTwentyFivePercentDecliners,
            returns: [...previousValue.returns, percentReturn],
          };
          data.set(candle.dateStr!, valueToSet);
        } else {
          const valueToSet: MarketBreadthPoint = {
            dateStr: candle.dateStr!,
            advances: isAdvancing ? 1 : 0,
            declines: isDeclining ? 1 : 0,
            upVolume: isAdvancing ? candle.volume * candle.close : 0,
            downVolume: isDeclining ? candle.volume * candle.close : 0,
            fiftyTwoWeekHighs: newHigh ? 1 : 0,
            fiftyTwoWeekLows: newLow ? 1 : 0,
            fourPercentAdvancers: aboveFourPercent ? 1 : 0,
            fourPercentDecliners: declineFourPercent ? 1 : 0,
            oneMonthTwentyFivePercentAdvancers: oneMontAboveTwentyFivePercent
              ? 1
              : 0,
            oneMonthTwentyFivePercentDecliners:
              oneMonthDeclineAboveTwentyFivePercent ? 1 : 0,
            threeMonthTwentyFivePercentAdvancers:
              threeMontAboveTwentyFivePercent ? 1 : 0,
            threeMonthTwentyFivePercentDecliners:
              threeMonthDeclineAboveTwentyFivePercent ? 1 : 0,
            returns: [percentReturn],
          };
          data.set(candle.dateStr!, valueToSet);
        }
      }
    }

    // Calculate Advance Decline Line
    const advanceDeclineLine: AdvanceDeclineDataPoint[] = [];
    const marketReturnsLine: MarketReturnsDataPoint[] = [];
    const newHighsNewLowsLine: FiftyTwoWeekHighsLowsDataPoint[] = [];
    const upDownVolumeLine: UpDownDataPoint[] = [];
    const upFourPercentLine: DateCount[] = [];
    const downFourPercentLine: DateCount[] = [];
    const oneMonthUpTwenyFivePercentLine: DateCount[] = [];
    const oneMonthDownTwenyFivePercentLine: DateCount[] = [];
    const threeMonthUpTwenyFivePercentLine: DateCount[] = [];
    const threeMonthDownTwenyFivePercentLine: DateCount[] = [];

    let cumulativeValue = 0;

    const entries = Array.from(data.entries());

    for (const [date, value] of entries) {
      cumulativeValue += value.advances - value.declines;
      advanceDeclineLine.push({
        dateStr: date,
        cumulative: cumulativeValue,
        advances: value.advances,
        declines: value.declines,
      });

      newHighsNewLowsLine.push({
        dateStr: date,
        fiftyTwoWeekHighs: value.fiftyTwoWeekHighs || 0,
        fiftyTwoWeekLows: value.fiftyTwoWeekLows || 0,
      });

      upDownVolumeLine.push({
        dateStr: date,
        upVolume: value.upVolume,
        downVolume: value.downVolume,
      });

      upFourPercentLine.push({
        dateStr: date,
        count: Number(value.fourPercentAdvancers),
      });

      downFourPercentLine.push({
        dateStr: date,
        count: Number(value.fourPercentDecliners),
      });

      oneMonthUpTwenyFivePercentLine.push({
        dateStr: date,
        count: Number(value.oneMonthTwentyFivePercentAdvancers),
      });

      oneMonthDownTwenyFivePercentLine.push({
        dateStr: date,
        count: Number(value.oneMonthTwentyFivePercentDecliners),
      });

      threeMonthUpTwenyFivePercentLine.push({
        dateStr: date,
        count: Number(value.threeMonthTwentyFivePercentAdvancers),
      });

      threeMonthDownTwenyFivePercentLine.push({
        dateStr: date,
        count: Number(value.threeMonthTwentyFivePercentDecliners),
      });

      const mean = calculateMean(value.returns) as number;
      const median = calculateMedian(value.returns) as number;

      marketReturnsLine.push({
        dateStr: date,
        mean: Number(mean.toFixed(2)),
        median: Number(median.toFixed(2)),
      });
    }

    const percentAboveTwentySMA = this.getPercentAboveSMALine(
      universeOfStockKeys,
      20,
      startMillis,
      endMillis
    );

    const percentAboveFiftySMA = this.getPercentAboveSMALine(
      universeOfStockKeys,
      50,
      startMillis,
      endMillis
    );

    const percentAboveTwoHundredSMA = this.getPercentAboveSMALine(
      universeOfStockKeys,
      200,
      startMillis,
      endMillis
    );

    const oneYearAnd40Days = new Date(
      currentDate.getFullYear() - 1,
      currentDate.getMonth(),
      currentDate.getDate() - 60,
      currentDate.getHours(),
      currentDate.getMinutes(),
      currentDate.getSeconds(),
      currentDate.getMilliseconds()
    );

    return {
      advanceDeclineLine: advanceDeclineLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      mcClellanOscillator: this.getMcClellanOscillator(advanceDeclineLine)
        .lineSeries.filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      fiftyTwoWeekHighsLowsLine: newHighsNewLowsLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      upDownVolumeLine: upDownVolumeLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      upFourPercentLine: upFourPercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      downFourPercentLine: downFourPercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      oneMonthUpTwentyFivePercentyLine: oneMonthUpTwenyFivePercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      oneMonthDownTwentyFivePercentyLine: oneMonthDownTwenyFivePercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      threeMonthsUpTwentyFivePercentyLine: threeMonthUpTwenyFivePercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      threeMonthsDownTwentyFivePercentyLine: threeMonthDownTwenyFivePercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      percentAboveTwentySMA: isDataError(percentAboveTwentySMA)
        ? []
        : percentAboveTwentySMA.timeSeries
            .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
            .sort(
              (a, b) =>
                new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
            ),
      percentAboveFiftySMA: isDataError(percentAboveFiftySMA)
        ? []
        : percentAboveFiftySMA.timeSeries
            .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
            .sort(
              (a, b) =>
                new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
            ),
      percentAboveTwoHundredSMA: isDataError(percentAboveTwoHundredSMA)
        ? []
        : percentAboveTwoHundredSMA.timeSeries.filter(
            (d) => new Date(d.dateStr) >= oneYearAnd40Days
          ),
      totalStockCount: count,
      marketReturnsLine: marketReturnsLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
    };
  }

  private buildDailyTickerData() {
    const currentDate = new Date();

    // Calculate the date 2 years and one day ago
    const twoYearsOneDayAgo = new Date(
      currentDate.getFullYear() - 2,
      currentDate.getMonth(),
      currentDate.getDate() - 1,
      currentDate.getHours(),
      currentDate.getMinutes(),
      currentDate.getSeconds(),
      currentDate.getMilliseconds()
    );

    // Get the time in milliseconds
    const startMillis = twoYearsOneDayAgo.getTime();
    const endMillis = currentDate.getTime();

    console.log("Building market breadth for all stocks");

    const stocks = this.symbolSvc.getStocks();
    const universeOfStockKeys = stocks.map((s) => s.Symbol);

    const data: Map<string, DailyMarketBreadthPoint[]> = new Map();

    for (const c of universeOfStockKeys) {
      const candles: Candle[] = this.cacheSvc.getCandles(c);
      const filteredCandles = candles.filter(
        (c) => c.date >= startMillis && c.date <= endMillis
      );

      if (filteredCandles.length < 252) {
        continue;
      }
      this.stocks.add(c);
      const sorted = [...filteredCandles].sort((a, b) => {
        if (a.date > b.date) {
          return 1;
        } else if (a.date < b.date) {
          return -1;
        }
        return 0;
      });
      const tickerData: DailyMarketBreadthPoint[] = [];
      for (let i = 60; i < sorted.length; i++) {
        if (!this.tradingDates.includes(candles[i].dateStr!)) {
          this.tradingDates.push(candles[i].dateStr!);
        }
        const candle = sorted[i];
        const prevCandle = sorted[i - 1];

        const oneWeekAgoCandle = sorted[i - 5];
        const oneMonthAgoCandle = sorted[i - 20];
        const threeMonthsAgoCandle = sorted[i - 60];

        const percentReturn =
          100 * ((candle.close - prevCandle.close) / prevCandle.close);

        const oneWeekPercentReturn =
          100 *
          ((candle.close - oneWeekAgoCandle.close) / oneWeekAgoCandle.close);
        const oneMonthPercentReturn =
          100 *
          ((candle.close - oneMonthAgoCandle.close) / oneMonthAgoCandle.close);
        const threeMonthPercentReturn =
          100 *
          ((candle.close - threeMonthsAgoCandle.close) /
            threeMonthsAgoCandle.close);

        let newHigh = false;
        let newLow = false;
        const windowSize = 252;

        if (i >= windowSize) {
          const windowCandles = sorted.slice(i - windowSize + 1, i + 1);
          const fiftyTwoWeekHigh = Math.max(
            ...windowCandles.map((c) => c.high)
          );
          const fiftyTwoWeekLow = Math.min(...windowCandles.map((c) => c.low));

          if (fiftyTwoWeekHigh == candle.high) {
            newHigh = true;
          }

          if (fiftyTwoWeekLow == candle.low) {
            newLow = true;
          }
        }

        let tenEMA = undefined;
        let twentyOneEMA = undefined;
        let fiftySMA = undefined;
        let twoHundredSMA = undefined;

        if (i > 10) {
          const windowCandles = sorted.slice(0, i + 1);
          tenEMA = ema(
            10,
            windowCandles.map((c) => c.close)
          );
        }

        if (i > 21) {
          const windowCandles = sorted.slice(0, i + 1);
          twentyOneEMA = ema(
            21,
            windowCandles.map((c) => c.close)
          );
        }

        if (i > 50) {
          const windowCandles = sorted.slice(i - 50 + 1, i + 1);
          fiftySMA = sma(
            50,
            windowCandles.map((c) => c.close)
          );
        }

        if (i > 200) {
          const windowCandles = sorted.slice(i - 200 + 1, i + 1);
          twoHundredSMA = sma(
            200,
            windowCandles.map((c) => c.close)
          );
        }

        const advancing = candle.close > prevCandle.close;
        const declining = candle.close < prevCandle.close;

        const dataPoint: DailyMarketBreadthPoint = {
          dateStr: candle.dateStr!,
          profile: stocks.find((s) => s.Symbol === c)!,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          oneDayReturn: percentReturn,
          oneMonthReturn: oneMonthPercentReturn,
          threeMonthReturn: threeMonthPercentReturn,
          oneWeekReturn: oneWeekPercentReturn,
          fiftyTwoWeekHigh: newHigh,
          newFiftfiftyTwoWeekLow: newLow,
          tenEMA: isMovingAverageError(tenEMA) ? undefined : tenEMA,
          twentyOneEMA: isMovingAverageError(twentyOneEMA)
            ? undefined
            : twentyOneEMA,
          fiftySMA: isMovingAverageError(fiftySMA) ? undefined : fiftySMA,
          twoHundredSMA: isMovingAverageError(twoHundredSMA)
            ? undefined
            : twoHundredSMA,
          advancingOrDeclining: advancing
            ? "advancing"
            : declining
            ? "declining"
            : "flat",
        };

        tickerData.push(dataPoint);
      }

      data.set(c, tickerData);
    }

    this.tickerDailyData = data;
  }

  private buildMarketBreadthFromDailyTickerData(
    fitlerFn: (symbol: FMPSymbolProfileData) => boolean = (_) => true
  ): NewMarketBreadthOverview {
    console.log("Building market breadth from ticker data");
    const dailyBreadthMap: Map<string, NewMarketBreadthPoint> = new Map();
    this.tradingDates.forEach((dateStr) => {
      const tickersData: DailyMarketBreadthPoint[] = [];

      let advancing = 0;
      let declining = 0;
      let upVolume = 0;
      let downVolume = 0;
      let oneDayUpFourPercent = 0;
      let oneDayDownFourPercent = 0;
      let upTwentyFivePercentInOneMonth = 0;
      let downTwentyFivePercentInOneMonth = 0;
      let upTwentyFivePercentInThreeMonths = 0;
      let downTwentyFivePercentInThreeMonths = 0;
      let aboveTenEMA = 0;
      let aboveTwentyOneEMA = 0;
      let aboveFiftySMA = 0;
      let aboveTwoHundredSMA = 0;
      let fiftyTwoWeekHighs = 0;
      let fiftyTwoWeekLows = 0;

      const returns: number[] = [];

      this.tickerDailyData.forEach((data, ticker) => {
        const dayData = data.find((d) => d.dateStr === dateStr);
        if (dayData && fitlerFn(dayData.profile)) {
          tickersData.push(dayData);

          if (dayData.advancingOrDeclining == "advancing") {
            advancing = advancing + 1;
            upVolume = upVolume + dayData.volume * dayData.close;
          } else if (dayData.advancingOrDeclining == "declining") {
            declining = declining + 1;
            downVolume = downVolume + dayData.volume * dayData.close;
          }

          if (dayData.oneDayReturn > 4) {
            oneDayUpFourPercent = oneDayUpFourPercent + 1;
          } else if (dayData.oneDayReturn < -4) {
            oneDayDownFourPercent = oneDayDownFourPercent + 1;
          }

          if (dayData.oneMonthReturn > 25) {
            upTwentyFivePercentInOneMonth = upTwentyFivePercentInOneMonth + 1;
          } else if (dayData.oneMonthReturn < -25) {
            downTwentyFivePercentInOneMonth =
              downTwentyFivePercentInOneMonth + 1;
          }

          if (dayData.fiftyTwoWeekHigh) {
            fiftyTwoWeekHighs = fiftyTwoWeekHighs + 1;
          } else if (dayData.newFiftfiftyTwoWeekLow) {
            fiftyTwoWeekLows = fiftyTwoWeekLows + 1;
          }

          if (dayData.threeMonthReturn > 25) {
            upTwentyFivePercentInThreeMonths =
              upTwentyFivePercentInThreeMonths + 1;
          } else if (dayData.threeMonthReturn < -25) {
            downTwentyFivePercentInThreeMonths =
              downTwentyFivePercentInThreeMonths + 1;
          }

          if (dayData.tenEMA && dayData.close > dayData.tenEMA) {
            aboveTenEMA = aboveTenEMA + 1;
          }

          if (dayData.twentyOneEMA && dayData.close > dayData.twentyOneEMA) {
            aboveTwentyOneEMA = aboveTwentyOneEMA + 1;
          }

          if (dayData.fiftySMA && dayData.close > dayData.fiftySMA) {
            aboveFiftySMA = aboveFiftySMA + 1;
          }

          if (dayData.twoHundredSMA && dayData.close > dayData.twoHundredSMA) {
            aboveTwoHundredSMA = aboveTwoHundredSMA + 1;
          }

          returns.push(dayData.oneDayReturn);
        }
      });

      if (tickersData.length > 0) {
        const totalCount = tickersData.length;
        const advancing = tickersData.filter(
          (p) => p.advancingOrDeclining === "advancing"
        );
        const declining = tickersData.filter(
          (p) => p.advancingOrDeclining === "declining"
        );

        const mean = calculateMean(returns);
        const meddian = calculateMedian(returns);

        const percentAboveTenEMA = Number(
          ((aboveTenEMA / totalCount) * 100).toFixed(2)
        );
        const percentAboveTwentyOneEMA = Number(
          ((aboveTwentyOneEMA / totalCount) * 100).toFixed(2)
        );
        const percentAboveFiftySMA = Number(
          ((aboveFiftySMA / totalCount) * 100).toFixed(2)
        );
        const percentAboveTwoHundredSMA = Number(
          ((aboveTwoHundredSMA / totalCount) * 100).toFixed(2)
        );

        const adlNetRatio = Number(
          (
            ((advancing.length - declining.length) /
              Math.max(1, advancing.length + declining.length)) *
            100
          ).toFixed(2)
        );

        const hlNetRatio = Number(
          (((fiftyTwoWeekHighs - fiftyTwoWeekLows) / totalCount) * 100).toFixed(
            2
          )
        );

        const upDownRatio = upVolume / downVolume;
        const upDownAdjusted = upDownRatio < 1 ? upDownRatio - 15 : upDownRatio;

        const stDailyRatio = oneDayUpFourPercent / (oneDayDownFourPercent || 1); //divide by 0
        const stDailyRatioAdjusted =
          stDailyRatio < 1 ? stDailyRatio - 20 : stDailyRatio;

        const globalDailyBreadth =
          mean! * 5000 +
          adlNetRatio * 500 +
          hlNetRatio * 500 +
          2.5 * upDownAdjusted +
          10 * stDailyRatioAdjusted;

        const point: NewMarketBreadthPoint = {
          totalStockCount: totalCount,
          dateStr: dateStr,
          advances: advancing.length,
          declines: declining.length,
          upVolume: upVolume,
          downVolume: downVolume,
          fourPercentAdvancers: oneDayUpFourPercent,
          fourPercentDecliners: oneDayDownFourPercent,
          oneMonthTwentyFivePercentAdvancers: upTwentyFivePercentInOneMonth,
          oneMonthTwentyFivePercentDecliners: downTwentyFivePercentInOneMonth,
          threeMonthTwentyFivePercentAdvancers:
            upTwentyFivePercentInThreeMonths,
          threeMonthTwentyFivePercentDecliners:
            downTwentyFivePercentInThreeMonths,
          meanReturn: Number(mean!.toFixed(2)),
          medianReturn: Number(meddian!.toFixed(2)),
          percentAboveTenEMA: percentAboveTenEMA,
          percentAboveTwentyOneEMA: percentAboveTwentyOneEMA,
          percentAboveFiftySMA: percentAboveFiftySMA,
          percentAboveTwoHundredSMA: percentAboveTwoHundredSMA,
          fiftyTwoWeekHighs: fiftyTwoWeekHighs,
          fiftyTwoWeekLows: fiftyTwoWeekLows,
          globalDailyBreadth: globalDailyBreadth,
        };
        dailyBreadthMap.set(dateStr, point);
      }
    });

    // Calculate Advance Decline Line
    const advanceDeclineLine: AdvanceDeclineDataPoint[] = [];
    const marketReturnsLine: MarketReturnsDataPoint[] = [];
    const newHighsNewLowsLine: FiftyTwoWeekHighsLowsDataPoint[] = [];
    const upDownVolumeLine: UpDownDataPoint[] = [];
    const upFourPercentLine: DateCount[] = [];
    const downFourPercentLine: DateCount[] = [];
    const oneMonthUpTwenyFivePercentLine: DateCount[] = [];
    const oneMonthDownTwenyFivePercentLine: DateCount[] = [];
    const threeMonthUpTwenyFivePercentLine: DateCount[] = [];
    const threeMonthDownTwenyFivePercentLine: DateCount[] = [];
    const globalDailyBreadthLine: GlobalDailyBreadthDataPoint[] = [];
    const totalStockCountLine: DateCount[] = [];
    const percentAboveTenEMALine: PercentAboveMAPoint[] = [];
    const percentAboveTwentyOneEMALine: PercentAboveMAPoint[] = [];
    const percentAboveFiftySMALine: PercentAboveMAPoint[] = [];
    const percentAboveTwoHundredSMALine: PercentAboveMAPoint[] = [];
    let cumulativeValue = 0;
    let cumulativeGDB = 0;
    const entries = Array.from(dailyBreadthMap.entries());

    // Sort the array based on the keys (dates in 'YYYY-MM-DD' format)
    entries.sort((a, b) => {
      // Parse dates from keys and compare
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateA.getTime() - dateB.getTime();
    });

    // Convert sorted array back to a Map
    const sortedMap = new Map(entries);

    for (const [date, value] of sortedMap) {
      cumulativeValue += value.advances - value.declines;
      cumulativeGDB += value.globalDailyBreadth;
      advanceDeclineLine.push({
        dateStr: date,
        cumulative: cumulativeValue,
        advances: value.advances,
        declines: value.declines,
      });

      globalDailyBreadthLine.push({
        dateStr: date,
        globalDailyBreadth: Number(value.globalDailyBreadth.toFixed(2)),
        cumulative: Number(cumulativeGDB.toFixed(2)),
      });

      newHighsNewLowsLine.push({
        dateStr: date,
        fiftyTwoWeekHighs: value.fiftyTwoWeekHighs || 0,
        fiftyTwoWeekLows: value.fiftyTwoWeekLows || 0,
      });

      upDownVolumeLine.push({
        dateStr: date,
        upVolume: value.upVolume,
        downVolume: value.downVolume,
      });

      upFourPercentLine.push({
        dateStr: date,
        count: Number(value.fourPercentAdvancers),
      });

      downFourPercentLine.push({
        dateStr: date,
        count: Number(value.fourPercentDecliners),
      });

      oneMonthUpTwenyFivePercentLine.push({
        dateStr: date,
        count: Number(value.oneMonthTwentyFivePercentAdvancers),
      });

      oneMonthDownTwenyFivePercentLine.push({
        dateStr: date,
        count: Number(value.oneMonthTwentyFivePercentDecliners),
      });

      threeMonthUpTwenyFivePercentLine.push({
        dateStr: date,
        count: Number(value.threeMonthTwentyFivePercentAdvancers),
      });

      threeMonthDownTwenyFivePercentLine.push({
        dateStr: date,
        count: Number(value.threeMonthTwentyFivePercentDecliners),
      });

      percentAboveTenEMALine.push({
        dateStr: date,
        percentAboveMA: value.percentAboveTenEMA,
      });

      percentAboveTwentyOneEMALine.push({
        dateStr: date,
        percentAboveMA: value.percentAboveTwentyOneEMA,
      });

      percentAboveFiftySMALine.push({
        dateStr: date,
        percentAboveMA: value.percentAboveFiftySMA,
      });

      percentAboveTwoHundredSMALine.push({
        dateStr: date,
        percentAboveMA: value.percentAboveTwoHundredSMA,
      });

      marketReturnsLine.push({
        dateStr: date,
        mean: value.meanReturn,
        median: value.medianReturn,
      });
      totalStockCountLine.push({
        dateStr: date,
        count: value.totalStockCount,
      });
    }
    const currentDate = new Date();

    const oneYearAnd40Days = new Date(
      currentDate.getFullYear() - 1,
      currentDate.getMonth(),
      currentDate.getDate() - 60,
      currentDate.getHours(),
      currentDate.getMinutes(),
      currentDate.getSeconds(),
      currentDate.getMilliseconds()
    );

    const mbo: NewMarketBreadthOverview = {
      advanceDeclineLine: advanceDeclineLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      mcClellanOscillator: this.getMcClellanOscillator(advanceDeclineLine)
        .lineSeries.filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      fiftyTwoWeekHighsLowsLine: newHighsNewLowsLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      upDownVolumeLine: upDownVolumeLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      upFourPercentLine: upFourPercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      downFourPercentLine: downFourPercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      oneMonthUpTwentyFivePercentyLine: oneMonthUpTwenyFivePercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      oneMonthDownTwentyFivePercentyLine: oneMonthDownTwenyFivePercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      threeMonthsUpTwentyFivePercentyLine: threeMonthUpTwenyFivePercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      threeMonthsDownTwentyFivePercentyLine: threeMonthDownTwenyFivePercentLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      percentAboveTenEMA: percentAboveTenEMALine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      percentAboveTwentyOneEMA: percentAboveTwentyOneEMALine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      percentAboveFiftySMA: percentAboveFiftySMALine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      percentAboveTwoHundredSMA: percentAboveTwoHundredSMALine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      marketReturnsLine: marketReturnsLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      stockCountLine: totalStockCountLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      globalDailyBreadthLine: globalDailyBreadthLine
        .filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
    };

    return mbo;
  }

  public getGeneralMarketOverview(): GeneralMarkeOverview {
    return this.generalMarketOverview;
  }

  public getCachedMarketBreadtOverview(): NewMarketBreadthOverview {
    return this.marketBreadthOverview;
  }

  public getRealtimeMarketBreadthOverview(
    cachedMarketBreadthOverview: NewMarketBreadthOverview,
    filter: (quote: Quote) => boolean = (_) => true
  ): NewMarketBreadthOverview {
    const currentDate = new Date();
    const twoYearsOneDayAgo = new Date(
      currentDate.getFullYear() - 2,
      currentDate.getMonth(),
      currentDate.getDate() - 1,
      currentDate.getHours(),
      currentDate.getMinutes(),
      currentDate.getSeconds(),
      currentDate.getMilliseconds()
    );

    // Get the time in milliseconds
    const startMillis = twoYearsOneDayAgo.getTime();
    const endMillis = currentDate.getTime();
    const currentDateStr = formatDateFromMillisecondsToEST(
      currentDate.getTime()
    );

    const cachedDates = cachedMarketBreadthOverview.advanceDeclineLine.map(
      (ad) => ad.dateStr
    );
    const realTime = this.realtimQuoteService.getAllLatestQuotes();

    let count = 0;
    let aboveTenEMA = 0;
    let aboveTwentyOneEMA = 0;
    let aboveFiftySMA = 0;
    let aboveTwoHundredSMA = 0;
    let advancing = 0;
    let declining = 0;
    let upVolume = 0;
    let downVolume = 0;
    let upFourPercent = 0;
    let downFourPercent = 0;
    let upTwentyFivePercentInOneMonth = 0;
    let downTwentyFivePercentInOneMonth = 0;
    let upTwentyFivePercentInThreeMonths = 0;
    let downTwentyFivePercentInThreeMonths = 0;
    let newFiftyTwoWeekHighs = 0;
    let newFiftyTwoWeekLows = 0;

    const allReturns: number[] = [];

    for (const [ticker, quote] of realTime) {
      const quoteDateStr = formatDateFromMillisecondsToEST(
        quote.timestamp * 1000
      );

      if (
        this.stocks.has(ticker) &&
        filter(quote) &&
        !cachedDates.includes(quoteDateStr) &&
        quoteDateStr === currentDateStr
      ) {
        count = count + 1;
        const dailyTenEMA = this.cacheSvc.getDailyTenEMA(ticker);
        const dailyTwentyOneEMA = this.cacheSvc.getDailyTwentyOneEMA(ticker);
        const dailyFiftySMA = this.cacheSvc.getDailyFiftySMA(ticker);
        const dailyTwoHundredSMA = this.cacheSvc.getDailyTwoHundredSMA(ticker);

        if (dailyTenEMA && quote.price > dailyTenEMA) {
          aboveTenEMA = aboveTenEMA + 1;
        }
        if (dailyTwentyOneEMA && quote.price > dailyTwentyOneEMA) {
          aboveTwentyOneEMA = aboveTwentyOneEMA + 1;
        }

        if (dailyFiftySMA && quote.price > dailyFiftySMA) {
          aboveFiftySMA = aboveFiftySMA + 1;
        }

        if (dailyTwoHundredSMA && quote.price > dailyTwoHundredSMA) {
          aboveTwoHundredSMA = aboveTwoHundredSMA + 1;
        }

        const candles: Candle[] = this.cacheSvc.getCandles(ticker);
        const filteredCandles = candles.filter(
          (c) => c.date >= startMillis && c.date <= endMillis
        );

        if (filteredCandles.length < 252) {
          continue;
        }

        const sorted = [...filteredCandles].sort((a, b) => {
          if (a.date > b.date) {
            return 1;
          } else if (a.date < b.date) {
            return -1;
          }
          return 0;
        });

        allReturns.push(quote.changesPercentage);

        const oneMonthAgoCandle = sorted[sorted.length - 20];
        const threeMonthAgoCandle = sorted[sorted.length - 60];

        const oneMonthChangePercent =
          100 *
          ((quote.price - oneMonthAgoCandle.close) / oneMonthAgoCandle.close);
        const threeMonthChangePercent =
          100 *
          ((quote.price - threeMonthAgoCandle.close) /
            threeMonthAgoCandle.close);

        if (quote.price > quote.previousClose) {
          advancing = advancing + 1;
          upVolume = upVolume + quote.volume * quote.price;
        }
        if (quote.price < quote.previousClose) {
          declining = declining + 1;
          downVolume = downVolume + quote.volume * quote.price;
        }

        if (quote.changesPercentage > 4) {
          upFourPercent = upFourPercent + 1;
        }
        if (quote.changesPercentage < -4) {
          downFourPercent = downFourPercent + 1;
        }
        if (oneMonthChangePercent > 25) {
          upTwentyFivePercentInOneMonth = upTwentyFivePercentInOneMonth + 1;
        }
        if (oneMonthChangePercent < -25) {
          downTwentyFivePercentInOneMonth = downTwentyFivePercentInOneMonth + 1;
        }

        if (threeMonthChangePercent > 25) {
          upTwentyFivePercentInThreeMonths =
            upTwentyFivePercentInThreeMonths + 1;
        }
        if (threeMonthChangePercent < -25) {
          downTwentyFivePercentInThreeMonths =
            downTwentyFivePercentInThreeMonths + 1;
        }

        if (quote.dayHigh >= quote.yearHigh) {
          newFiftyTwoWeekHighs = newFiftyTwoWeekHighs + 1;
        }
        if (quote.dayLow <= quote.yearLow) {
          newFiftyTwoWeekLows = newFiftyTwoWeekLows + 1;
        }
      }
    }

    if (allReturns.length === 0) {
      return cachedMarketBreadthOverview; //no new data since cache refresh
    }

    //setup advance/decline data for today if not in cached
    const advanceDeclineLine: AdvanceDeclineDataPoint[] = [];
    const newHighsNewLowsLine: FiftyTwoWeekHighsLowsDataPoint[] = [];
    const upDownVolumeLine: UpDownDataPoint[] = [];
    const upFourPercentLine: DateCount[] = [];
    const downFourPercentLine: DateCount[] = [];
    const oneMonthUpTwenyFivePercentLine: DateCount[] = [];
    const oneMonthDownTwenyFivePercentLine: DateCount[] = [];
    const threeMonthUpTwenyFivePercentLine: DateCount[] = [];
    const threeMonthDownTwenyFivePercentLine: DateCount[] = [];
    const marketReturnsLine: MarketReturnsDataPoint[] = [];
    const totalCountLine: DateCount[] = [];
    const globalDailyBreadthLine: GlobalDailyBreadthDataPoint[] = [];

    const mean = calculateMean(allReturns) as number;
    const median = calculateMedian(allReturns) as number;

    const adlNetRatio = Number(
      (
        ((advancing - declining) / Math.max(1, advancing + declining)) *
        100
      ).toFixed(2)
    );

    const hlNetRatio = Number(
      (((newFiftyTwoWeekHighs - newFiftyTwoWeekHighs) / count) * 100).toFixed(2)
    );

    const upDownRatio = upVolume / downVolume;
    const upDownAdjusted = upDownRatio < 1 ? upDownRatio - 15 : upDownRatio;

    const stDailyRatio = upFourPercent / (downFourPercent || 1); //divide by 0
    const stDailyRatioAdjusted =
      stDailyRatio < 1 ? stDailyRatio - 20 : stDailyRatio;

    const globalDailyBreadth =
      mean! * 5000 +
      adlNetRatio * 500 +
      hlNetRatio * 500 +
      2.5 * upDownAdjusted +
      10 * stDailyRatioAdjusted;

    const cumulativeGDB =
      cachedMarketBreadthOverview.globalDailyBreadthLine[
        cachedMarketBreadthOverview.globalDailyBreadthLine.length - 1
      ].cumulative;

    let cumulativeValue =
      cachedMarketBreadthOverview.advanceDeclineLine[
        cachedMarketBreadthOverview.advanceDeclineLine.length - 1
      ].cumulative + globalDailyBreadth;

    cumulativeValue += advancing - declining;
    advanceDeclineLine.push({
      dateStr: currentDateStr,
      cumulative: cumulativeValue,
      advances: advancing,
      declines: declining,
    });

    globalDailyBreadthLine.push({
      dateStr: currentDateStr,
      globalDailyBreadth: Number(globalDailyBreadth.toFixed(2)),
      cumulative: Number(cumulativeGDB.toFixed(2)),
    });

    totalCountLine.push({
      dateStr: currentDateStr,
      count: count,
    });

    newHighsNewLowsLine.push({
      dateStr: currentDateStr,
      fiftyTwoWeekHighs: newFiftyTwoWeekHighs || 0,
      fiftyTwoWeekLows: newFiftyTwoWeekLows || 0,
    });

    upDownVolumeLine.push({
      dateStr: currentDateStr,
      upVolume: upVolume,
      downVolume: downVolume,
    });

    upFourPercentLine.push({
      dateStr: currentDateStr,
      count: Number(upFourPercent),
    });

    downFourPercentLine.push({
      dateStr: currentDateStr,
      count: Number(downFourPercent),
    });

    oneMonthUpTwenyFivePercentLine.push({
      dateStr: currentDateStr,
      count: Number(upTwentyFivePercentInOneMonth),
    });

    oneMonthDownTwenyFivePercentLine.push({
      dateStr: currentDateStr,
      count: Number(downTwentyFivePercentInOneMonth),
    });

    threeMonthUpTwenyFivePercentLine.push({
      dateStr: currentDateStr,
      count: Number(upTwentyFivePercentInThreeMonths),
    });

    threeMonthDownTwenyFivePercentLine.push({
      dateStr: currentDateStr,
      count: Number(downTwentyFivePercentInThreeMonths),
    });

    marketReturnsLine.push({
      dateStr: currentDateStr,
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
    });

    const adl = [
      ...cachedMarketBreadthOverview.advanceDeclineLine,
      ...advanceDeclineLine,
    ];

    const tenPoint: PercentAboveMAPoint[] = cachedDates.includes(currentDateStr)
      ? []
      : [
          {
            dateStr: currentDateStr,
            percentAboveMA: Number(((aboveTenEMA / count) * 100).toFixed(2)),
          },
        ];

    const twentyPoint: PercentAboveMAPoint[] = cachedDates.includes(
      currentDateStr
    )
      ? []
      : [
          {
            dateStr: currentDateStr,
            percentAboveMA: Number(
              ((aboveTwentyOneEMA / count) * 100).toFixed(2)
            ),
          },
        ];

    const fiftyPoint: PercentAboveMAPoint[] = cachedDates.includes(
      currentDateStr
    )
      ? []
      : [
          {
            dateStr: currentDateStr,
            percentAboveMA: Number(((aboveFiftySMA / count) * 100).toFixed(2)),
          },
        ];
    const twoHundredPoint: PercentAboveMAPoint[] = cachedDates.includes(
      currentDateStr
    )
      ? []
      : [
          {
            dateStr: currentDateStr,
            percentAboveMA: Number(
              ((aboveTwoHundredSMA / count) * 100).toFixed(2)
            ),
          },
        ];

    //use this to filter returned resultset to limit data transfer
    const oneYearAnd40Days = new Date(
      currentDate.getFullYear() - 1,
      currentDate.getMonth(),
      currentDate.getDate() - 40,
      currentDate.getHours(),
      currentDate.getMinutes(),
      currentDate.getSeconds(),
      currentDate.getMilliseconds()
    );

    //merging cached data with realtime data from today
    const merged: NewMarketBreadthOverview = {
      advanceDeclineLine: adl,
      globalDailyBreadthLine: globalDailyBreadthLine,
      marketReturnsLine: [
        ...cachedMarketBreadthOverview.marketReturnsLine,
        ...marketReturnsLine,
      ],
      upDownVolumeLine: [
        ...cachedMarketBreadthOverview.upDownVolumeLine,
        ...upDownVolumeLine,
      ],
      fiftyTwoWeekHighsLowsLine: [
        ...cachedMarketBreadthOverview.fiftyTwoWeekHighsLowsLine,
        ...newHighsNewLowsLine,
      ],
      mcClellanOscillator: this.getMcClellanOscillator(adl)
        .lineSeries.filter((d) => new Date(d.dateStr) >= oneYearAnd40Days)
        .sort(
          (a, b) =>
            new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
        ),
      percentAboveTenEMA: [
        ...cachedMarketBreadthOverview.percentAboveTenEMA,
        ...tenPoint,
      ],
      percentAboveTwentyOneEMA: [
        ...cachedMarketBreadthOverview.percentAboveTwentyOneEMA,
        ...twentyPoint,
      ],
      percentAboveFiftySMA: [
        ...cachedMarketBreadthOverview.percentAboveFiftySMA,
        ...fiftyPoint,
      ],
      percentAboveTwoHundredSMA: [
        ...cachedMarketBreadthOverview.percentAboveTwoHundredSMA,
        ...twoHundredPoint,
      ],
      upFourPercentLine: [
        ...cachedMarketBreadthOverview.upFourPercentLine,
        ...upFourPercentLine,
      ],
      downFourPercentLine: [
        ...cachedMarketBreadthOverview.downFourPercentLine,
        ...downFourPercentLine,
      ],
      oneMonthUpTwentyFivePercentyLine: [
        ...cachedMarketBreadthOverview.oneMonthUpTwentyFivePercentyLine,
        ...oneMonthUpTwenyFivePercentLine,
      ],
      oneMonthDownTwentyFivePercentyLine: [
        ...cachedMarketBreadthOverview.oneMonthDownTwentyFivePercentyLine,
        ...oneMonthDownTwenyFivePercentLine,
      ],
      threeMonthsUpTwentyFivePercentyLine: [
        ...cachedMarketBreadthOverview.threeMonthsUpTwentyFivePercentyLine,
        ...threeMonthUpTwenyFivePercentLine,
      ],
      threeMonthsDownTwentyFivePercentyLine: [
        ...cachedMarketBreadthOverview.threeMonthsDownTwentyFivePercentyLine,
        ...threeMonthDownTwenyFivePercentLine,
      ],
      stockCountLine: [
        ...cachedMarketBreadthOverview.stockCountLine,
        ...totalCountLine,
      ],
    };

    return merged;
  }

  public getExchangeMarketBreadthOverview(
    exchange: "nyse" | "nasdaq"
  ): NewMarketBreadthOverview | undefined {
    const filterFn = (quote: Quote) =>
      quote.exchange === exchange.toUpperCase();

    if (exchange === "nyse") {
      return this.getRealtimeMarketBreadthOverview(
        this.nyseMarketBreadthOverview,
        filterFn
      );
    } else if (exchange === "nasdaq") {
      return this.getRealtimeMarketBreadthOverview(
        this.nasdaqMarketBreadthOverview,
        filterFn
      );
    } else {
      return undefined;
    }
  }

  public getSectorMarketBreadthOvervew(
    sector: string
  ): NewMarketBreadthOverview | undefined {
    const overview = this.sectorBreadthOverview.get(sector);

    const mappedSector = sectorsNameMap.get(sector) || sector;

    if (overview && overview.advanceDeclineLine.length > 0) {
      const sectorFilter = (quote: Quote) => {
        const profile = this.symbolSvc
          .getStocks()
          .find((s) => s.Symbol === quote.symbol);
        return (
          profile?.sector?.toLowerCase() === mappedSector.toLowerCase() || false
        );
      };

      return this.getRealtimeMarketBreadthOverview(overview, sectorFilter);
    }

    return this.sectorBreadthOverview.get(sector);
  }

  private getMarketBreadthSnapshotPointFromOverview(
    overview: NewMarketBreadthOverview
  ) {
    const adlPoint =
      overview.advanceDeclineLine[overview.advanceDeclineLine.length - 1];

    const highsLow = overview.fiftyTwoWeekHighsLowsLine.find(
      (f) => f.dateStr === adlPoint.dateStr
    );
    const upFourPercent = overview.upFourPercentLine.find(
      (u) => u.dateStr === adlPoint.dateStr
    );
    const downFourPercent = overview.downFourPercentLine.find(
      (d) => d.dateStr === adlPoint.dateStr
    );
    const returnsPoint = overview.marketReturnsLine.find(
      (r) => r.dateStr === adlPoint.dateStr
    );

    const result: CurrentDayMarketBreadthSnapshotPoint = {
      advanceDecline: adlPoint,
      fiftyTwoWeekHighsLows: highsLow,
      upFourPercent: upFourPercent?.count,
      downFourPercent: downFourPercent?.count,
      returns: returnsPoint,
      totalStockCount: this.tickerDailyData.size,
    };

    return result;
  }

  public getMarketBreadthSnapshot(): CurrentDayMarketBreadthSnapshot {
    const universeOverview = this.getRealtimeMarketBreadthOverview(
      this.marketBreadthOverview
    );

    const nasdaqOverview = this.getExchangeMarketBreadthOverview("nasdaq");
    const nyseOverview = this.getExchangeMarketBreadthOverview("nyse");

    const sectorResults: SectorCurrentDayMarketBreadthSnapshot[] = [];

    this.sectorBreadthOverview.forEach((opverview, sector) => {
      const sectorOverview = this.getSectorMarketBreadthOvervew(sector);

      if (sectorOverview && sectorOverview.advanceDeclineLine.length > 1) {
        sectorResults.push({
          sector,
          overview:
            this.getMarketBreadthSnapshotPointFromOverview(sectorOverview),
        });
      }
    });

    return {
      universeOverview:
        this.getMarketBreadthSnapshotPointFromOverview(universeOverview),
      nasdaqOverview: this.getMarketBreadthSnapshotPointFromOverview(
        nasdaqOverview!
      ),
      nyseOverview: this.getMarketBreadthSnapshotPointFromOverview(
        nyseOverview!
      ),
      sectorsOverviews: sectorResults,
    };
  }

  public getMcClellanOscillator(
    advanceDeclineLine: AdvanceDeclineDataPoint[]
  ): McClellanOscillator {
    // Calculate McClellan Oscillator value for each date
    const mcclellanOscillator: McClellanOscillatorPoint[] = [];
    let cumulative = 0;
    for (let i = 40; i < advanceDeclineLine.length; i++) {
      const diffs = advanceDeclineLine
        .slice(0, i + 1)
        .map((ad) => ad.advances - ad.declines);
      const dateStr = advanceDeclineLine[i].dateStr;
      const ema19 = ema(19, diffs);
      const ema39 = ema(39, diffs);

      if (!isMovingAverageError(ema19) && !isMovingAverageError(ema39)) {
        const value = ema19 - ema39; // Subtract 39-day EMA from 19-day EMA
        cumulative = cumulative + value;
        mcclellanOscillator.push({ dateStr, value, cumulative });
      }
    }

    return {
      lineSeries: mcclellanOscillator,
    };
  }

  public getPercentAboveSMALine(
    tickers: Ticker[],
    period: number,
    startDateInMillis: number,
    endDateInMillis: number
  ): PercentAboveSMALine | DataError {
    console.log("calculating percent above 50sma");

    type SMADataPoint = {
      symbol: string;
      date: number;
      dateString: string;
      close: number;
      smaValue: number;
      percentFromSMA: number;
    };

    let allDataPoints: SMADataPoint[] = [];

    for (const ticker of tickers) {
      const candles: Candle[] = this.cacheSvc.getCandles(ticker);
      const filtered = candles.filter(
        (c) => c.date >= startDateInMillis && c.date <= endDateInMillis
      );

      const sorted = [...filtered].sort((a, b) => {
        if (a.date > b.date) {
          return 1;
        } else if (a.date < b.date) {
          return -1;
        }
        return 0;
      });

      const sma = calculateSMA(sorted, period);

      if (isMovingAverageError(sma)) {
        //console.log("Not enough candles to calculate SMA");
        continue;
      }

      for (const t of sma.timeseries) {
        const c = candles.find((c) => c.dateStr === t.time);

        if (!c || !c.dateStr) {
          console.log("unexpected error");
          continue;
        }
        const percentAwayFromSMA = Number(
          (((c.close - t.value) / t.value) * 100).toFixed(2)
        );

        const dataPoint: SMADataPoint = {
          symbol: ticker,
          date: c.date,
          dateString: c.dateStr!,
          close: c.close,
          percentFromSMA: percentAwayFromSMA,
          smaValue: t.value,
        };

        allDataPoints.push(dataPoint);
      }
    }

    const groupedByDate: { [dateString: string]: SMADataPoint[] } =
      allDataPoints.reduce((result, dataPoint) => {
        const dateKey = dataPoint.dateString;

        if (!result[dateKey]) {
          result[dateKey] = [];
        }

        result[dateKey].push(dataPoint);

        return result;
      }, {} as { [dateString: string]: SMADataPoint[] });

    const percentAboveSMAArray: PercentAboveMAPoint[] = Object.entries(
      groupedByDate
    ).map(([dateString, dataPoints]) => {
      const totalDataPoints = dataPoints.length;
      const aboveSMADataPoints = dataPoints.filter(
        (dp) => dp.percentFromSMA > 0
      ).length;

      const percentAboveSMA =
        Number(((aboveSMADataPoints / totalDataPoints) * 100).toFixed(2)) || 0;

      return {
        dateStr: dateString,
        percentAboveMA: percentAboveSMA,
      };
    });

    return {
      timeSeries: percentAboveSMAArray,
    };
  }

  public getPercentOfSuccessfulHighsTenDaysAgo(): number {
    const stocks = this.symbolSvc.getStocks();
    const universeOfStockKeys = stocks.map((s) => s.Symbol);

    let atHighTenDaysAgo = 0;
    let stillAboveTenDayighTenDaysAgo = 0;

    for (const c of universeOfStockKeys) {
      const candles: Candle[] = this.cacheSvc.getCandles(c);
      const lastYearsCandles = filterCandlesPast52Weeks(candles);
      const allButLast10 = lastYearsCandles.slice(0, -10);

      const highs = allButLast10.map((c) => c.high);

      if (Math.max(...highs) === highs[highs.length - 1]) {
        atHighTenDaysAgo = atHighTenDaysAgo + 1;

        if (
          lastYearsCandles[lastYearsCandles.length - 1].close >
          highs[highs.length - 1]
        ) {
          stillAboveTenDayighTenDaysAgo = stillAboveTenDayighTenDaysAgo + 1;
        }
      }
    }
    return Number(
      (100 * (stillAboveTenDayighTenDaysAgo / atHighTenDaysAgo)).toFixed(2)
    );
  }
}
