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
import { LevelsService } from "../../services/levels/levels-service";
import { SymbolService } from "../../services/symbol/symbol_service";
import { Candle } from "../../modles/candle";
import moment = require("moment");

@controller("/weekly")
export class WeeeklyController {
  constructor(
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService,
    @inject(TYPES.LevelsService) private levelsSvc: LevelsService
  ) {}

  @httpGet("/:ticker/volatility-levels")
  public async weeklyVolatilityLevels(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string,
    @queryParam("period") period: number
  ) {
    if (!period || !ticker) {
      res.status(400).json({ error: "Must specify a valid ticker and period" });
    } else {
      const weeklyE = await this.symbolSvc.getWeeklyCandlesForSymbol(
        ticker,
        "2012-01-01",
        undefined
      );

      switch (weeklyE.tag) {
        case "left":
          res.status(500).json({ error: weeklyE.value });
          break;

        case "right":
          const candles = weeklyE.value;

          if (!candles || candles.length < period) {
            res
              .status(500)
              .json({ error: `insufficient data found for ${ticker}` });
            return;
          }
          const [head, ...tail] = candles;

          const tailArr: Candle[] = tail.map((c) => {
            const mapped: Candle = {
              date: new Date(c.date).getTime(),
              dateStr: c.date,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume,
            };
            return mapped;
          });

          const levels = this.levelsSvc.calculateVolatilityLevels(
            ticker,
            period,
            tailArr.slice(period).reverse(),
            head.open
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

  @httpGet("/:ticker/volatility-levels-list")
  public async weeklyVolatilityLevelsList(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string,
    @queryParam("startDate") startDate: string,
    @queryParam("endDate") endDate: string,
    @queryParam("period") period: number
  ) {
    if (!period || !ticker) {
      res.status(400).json({ error: "Must specify a valid ticker and period" });
    } else {
      const weeklyE = await this.symbolSvc.getWeeklyCandlesForSymbol(
        ticker,
        startDate,
        endDate
      );

      switch (weeklyE.tag) {
        case "left":
          res.status(500).json({ error: weeklyE.value });
          break;

        case "right":
          const candles = weeklyE.value;

          if (!candles || candles.length < period) {
            res
              .status(500)
              .json({ error: `insufficient data found for ${ticker}` });
            return;
          }

          const reversed = candles.reverse();

          const mappedCandles: Candle[] = reversed.map((c) => {
            const mapped: Candle = {
              date: new Date(c.date).getTime(),
              dateStr: c.date,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume,
            };
            return mapped;
          });

          const levels = this.levelsSvc.calculateAllVolatilityLevels(
            ticker,
            period,
            mappedCandles
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
}
