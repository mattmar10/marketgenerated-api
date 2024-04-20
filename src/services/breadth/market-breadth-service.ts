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

@injectable()
export class MarketBreadthService {
  private marketBreadthOverview: MarketBreadthOverview;
  private nyseMarketBreadthOverview: MarketBreadthOverview;
  private nasdaqMarketBreadthOverview: MarketBreadthOverview;
  private sectorBreadthOverview: Map<string, MarketBreadthOverview> = new Map();
  private generalMarketOverview: GeneralMarkeOverview;
  private stocks: Set<string> = new Set<string>();

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
    this.marketBreadthOverview = this.buildMarketBreadth();
    this.nyseMarketBreadthOverview = this.buildMarketBreadth(
      (s) => s.exchangeShortName === "NYSE"
    );
    this.nasdaqMarketBreadthOverview = this.buildMarketBreadth(
      (s) => s.exchangeShortName === "NASDAQ"
    );

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
        const sectorBreadth = this.buildMarketBreadth(
          (s) => s.sector === sector
        );
        this.sectorBreadthOverview.set(
          sector.toLowerCase().replace(/ /g, "-"),
          sectorBreadth
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

      for (let i = 1; i < sorted.length; i++) {
        const candle = sorted[i];
        const prevCandle = sorted[i - 1];

        const percentReturn =
          100 * ((candle.close - prevCandle.close) / prevCandle.close);

        const isAdvancing = candle.close > prevCandle.close;
        const isDeclining = candle.close < prevCandle.close;
        const aboveFourPercent = percentReturn > 4;
        const declineFourPercent = percentReturn < -4;

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
              ? previousValue.upVolume + candle.volume
              : previousValue.upVolume,
            downVolume: isDeclining
              ? previousValue.downVolume + candle.volume
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
          };
          data.set(candle.dateStr!, valueToSet);
        } else {
          const valueToSet: MarketBreadthPoint = {
            dateStr: candle.dateStr!,
            advances: isAdvancing ? 1 : 0,
            declines: isDeclining ? 1 : 0,
            upVolume: isAdvancing ? candle.volume : 0,
            downVolume: isDeclining ? candle.volume : 0,
            fiftyTwoWeekHighs: newHigh ? 1 : 0,
            fiftyTwoWeekLows: newLow ? 1 : 0,
            fourPercentAdvancers: aboveFourPercent ? 1 : 0,
            fourPercentDecliners: declineFourPercent ? 1 : 0,
          };
          data.set(candle.dateStr!, valueToSet);
        }
      }
    }

    // Calculate Advance Decline Line
    const advanceDeclineLine: AdvanceDeclineDataPoint[] = [];
    const newHighsNewLowsLine: FiftyTwoWeekHighsLowsDataPoint[] = [];
    const upDownVolumeLine: UpDownDataPoint[] = [];
    const upFourPercentLine: DateCount[] = [];
    const downFourPercentLine: DateCount[] = [];
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
      totalStockCount: count,
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
    };
  }

  public getGeneralMarketOverview(): GeneralMarkeOverview {
    return this.generalMarketOverview;
  }

  public getCachedMarketBreadtOverview(): MarketBreadthOverview {
    return this.marketBreadthOverview;
  }

  public getRealtimeMarketBreadthOverview(
    cachedMarketBreadthOverview: MarketBreadthOverview,
    filter: (quote: Quote) => boolean = (_) => true
  ): MarketBreadthOverview {
    const currentDate = new Date();
    const currentDateStr = formatDateFromMillisecondsToEST(
      currentDate.getTime()
    );

    const cachedDates = cachedMarketBreadthOverview.advanceDeclineLine.map(
      (ad) => ad.dateStr
    );
    const realTime = this.realtimQuoteService.getAllLatestQuotes();
    const data: Map<string, MarketBreadthPoint> = new Map();

    let count = 0;
    let aboveTwentySMA = 0;
    let aboveFiftySMA = 0;
    let aboveTwoHundredSMA = 0;

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

        const dailyTwentySMA = this.cacheSvc.getDailyTwentySMA(ticker);

        if (dailyTwentySMA && quote.price > dailyTwentySMA) {
          aboveTwentySMA = aboveTwentySMA + 1;
        }

        if (quote.price > quote.priceAvg50) {
          aboveFiftySMA = aboveFiftySMA + 1;
        }

        if (quote.price > quote.priceAvg200) {
          aboveTwoHundredSMA = aboveTwoHundredSMA + 1;
        }

        const isAdvancing = quote.price > quote.previousClose;
        const isDeclining = quote.price < quote.previousClose;
        const aboveFourPercent = quote.changesPercentage > 4;
        const declineFourPercent = quote.changesPercentage < -4;

        let newHigh = quote.dayHigh >= quote.yearHigh;
        let newLow = quote.dayLow <= quote.yearLow;

        const previousValue = data.get(currentDateStr);
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
              ? previousValue.upVolume + quote.volume
              : previousValue.upVolume,
            downVolume: isDeclining
              ? previousValue.downVolume + quote.volume
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
          };
          data.set(currentDateStr, valueToSet);
        } else {
          const valueToSet: MarketBreadthPoint = {
            dateStr: currentDateStr,
            advances: isAdvancing ? 1 : 0,
            declines: isDeclining ? 1 : 0,
            upVolume: isAdvancing ? quote.volume : 0,
            downVolume: isDeclining ? quote.volume : 0,
            fiftyTwoWeekHighs: newHigh ? 1 : 0,
            fiftyTwoWeekLows: newLow ? 1 : 0,
            fourPercentAdvancers: aboveFourPercent ? 1 : 0,
            fourPercentDecliners: declineFourPercent ? 1 : 0,
          };
          data.set(currentDateStr, valueToSet);
        }
      }
    }

    //setup advance/decline data for today if not in cached
    const advanceDeclineLine: AdvanceDeclineDataPoint[] = [];
    const newHighsNewLowsLine: FiftyTwoWeekHighsLowsDataPoint[] = [];
    const upDownVolumeLine: UpDownDataPoint[] = [];
    const upFourPercentLine: DateCount[] = [];
    const downFourPercentLine: DateCount[] = [];

    const entries = Array.from(data.entries());

    let cumulativeValue =
      cachedMarketBreadthOverview.advanceDeclineLine[
        cachedMarketBreadthOverview.advanceDeclineLine.length - 1
      ].cumulative;

    for (const [date, value] of entries) {
      if (!cachedDates.includes(date)) {
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
      }
    }

    const adl = [
      ...cachedMarketBreadthOverview.advanceDeclineLine,
      ...advanceDeclineLine,
    ];

    //setup SMA points for today if not in cached
    const twentyPoint: PercentAboveMAPoint[] = cachedDates.includes(
      currentDateStr
    )
      ? []
      : [
          {
            dateStr: currentDateStr,
            percentAboveMA: Number(((aboveTwentySMA / count) * 100).toFixed(2)),
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
    const merged: MarketBreadthOverview = {
      advanceDeclineLine: adl,
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
      percentAboveTwentySMA: [
        ...cachedMarketBreadthOverview.percentAboveTwentySMA,
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
      totalStockCount: cachedMarketBreadthOverview.totalStockCount,
    };

    return merged;
  }

  public getExchangeMarketBreadthOverview(
    exchange: "nyse" | "nasdaq"
  ): MarketBreadthOverview | undefined {
    const filterFn = (quote: Quote) => quote.exchange === exchange;

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
  ): MarketBreadthOverview | undefined {
    const overview = this.sectorBreadthOverview.get(sector);

    if (overview) {
      const sectorFilter = (quote: Quote) => {
        const profile = this.symbolSvc
          .getStocks()
          .find((s) => s.Symbol === quote.symbol);
        return profile?.sector === sector || false;
      };

      return this.getRealtimeMarketBreadthOverview(overview, sectorFilter);
    }

    return this.sectorBreadthOverview.get(sector);
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
