import { NextFunction, Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  next,
  queryParam,
  request,
  requestParam,
  response,
} from "inversify-express-utils";
import TYPES from "../../types";
import { DailyCacheService } from "../../services/daily_cache_service";
import * as moment from "moment";
import { Candle } from "../../modles/candle";
import { formatDateFromMillisecondsToEST } from "../../utils/epoch_utils";
import { DailyReturn, DailyReturns } from "./daily-responses";
import { LevelsService } from "../../services/levels/levels-service";
import { SymbolService } from "../../services/symbol/symbol_service";
import { symbol } from "zod";
import { match } from "../../MarketGeneratedTypes";
import { CandleWithVolatilityData } from "../../services/levels/levels-types";

@controller("/daily")
export class DailyController {
  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService,
    @inject(TYPES.LevelsService) private levelsSvc: LevelsService
  ) {}

  @httpGet("/:ticker/prices")
  public dailyPrices(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string,
    @queryParam("startDate") startDate: string,
    @queryParam("endDate") endDate: string
  ) {
    const start = startDate ? moment(startDate) : new Date(2013, 1, 1);
    const end = endDate ? moment(endDate) : new Date();

    const startMillis = start.valueOf();
    const endMillis = end.valueOf();

    const result = this.cacheSvc.getCandlesWithFilter(
      ticker,
      (c) => c.date >= startMillis && c.date <= endMillis
    );

    res.json(result);
  }

  @httpGet("/:ticker/returns")
  public dailyReturns(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string,
    @queryParam("startDate") startDate: string,
    @queryParam("endDate") endDate: string
  ) {
    const start = startDate ? moment(startDate) : new Date(2013, 1, 1);
    const end = endDate ? moment(endDate) : new Date();

    const startMillis = start.valueOf();
    const endMillis = end.valueOf();

    const candles = this.cacheSvc.getCandlesWithFilter(
      ticker,
      (c) => c.date >= startMillis && c.date <= endMillis
    );

    const dailyreturns: DailyReturns = {
      returns: this.calculateDailyReturnsSeq(candles),
      symbol: ticker,
    };

    res.json(dailyreturns);
  }

  @httpGet("/:ticker/volatility-levels-list")
  public dailyVolatilityList(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string,
    @queryParam("startDate") startDate: string,
    @queryParam("endDate") endDate: string,
    @requestParam("period") period: number
  ) {
    const start = startDate ? moment(startDate) : new Date(2013, 1, 1);
    const end = endDate ? moment(endDate) : new Date();
    const startMillis = start.valueOf();
    const endMillis = end.valueOf();

    const result = this.cacheSvc.getCandlesWithFilter(
      ticker,
      (c) => c.date >= startMillis && c.date <= endMillis
    );

    const levelsE = this.levelsSvc.calculateAllVolatilityLevels(
      ticker,
      14,
      result
    );

    match(
      levelsE,
      (error) => {
        console.error(
          `Error calculating volatility levels: ${error} for ${symbol}`
        );
        res.status(500).json({ error: error });
      },
      (volatilityData) => {
        res.json(volatilityData);
      }
    );
  }

  @httpGet("/:ticker/volatility-levels")
  public async dailyVolatilityLevels(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string,
    @queryParam("period") period: number
  ) {
    if (!period || !ticker) {
      res.status(400).json({ error: "Must specify a valid ticker and period" });
    } else {
      const quote = await this.symbolSvc.getQuoteForSymbol(ticker);

      switch (quote.tag) {
        case "left":
          res.status(500).json({ error: quote.value });
          break;

        case "right":
          const candles = this.cacheSvc.getCandles(ticker);

          if (!candles || candles.length == 0) {
            res.status(500).json({ error: `no data found for ${ticker}` });
            return;
          }

          const levels = this.levelsSvc.calculateVolatilityLevels(
            ticker,
            period,
            candles.slice(-period),
            quote.value.open
          );

          switch (levels.tag) {
            case "left":
              res.status(500).json({ error: levels.value });
              break;

            case "right":
              res.json(levels.value);

              break;
          }

          break;
      }
    }
  }

  private calculateDailyReturnsSeq(candles: Candle[]): DailyReturn[] {
    const companyReturns: DailyReturn[] = candles
      .sort((a, b) => a.date - b.date)
      .map((candle, index, candles) => {
        if (index === 0) return null; // Skip the first element as there's no previous one
        const returns =
          (candle.close - candles[index - 1].close) / candles[index - 1].close;
        return {
          dt: candle.date,
          dateString: formatDateFromMillisecondsToEST(candle.date),
          returnPercent: Number((returns * 100).toFixed(2)),
        };
      })
      .filter((returnObj) => returnObj !== null) as DailyReturn[];

    return companyReturns;
  }
}
