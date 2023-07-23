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

@controller("/daily")
export class DailyController {
  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService
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
          returnPercent: returns * 100,
        };
      })
      .filter((returnObj) => returnObj !== null) as DailyReturn[];

    return companyReturns;
  }
}
