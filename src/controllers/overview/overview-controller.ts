import { Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  queryParam,
  request,
  requestParam,
  response,
} from "inversify-express-utils";
import { DailyCacheService } from "../../services/daily_cache_service";
import { OverviewService } from "../../services/overview/overview-service";
import TYPES from "../../types";
import moment = require("moment");
import { MajorStockIndex } from "../../services/stock-index/stock-index-types";

@controller("/overview")
export class OverviewController {
  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.OverviewService) private overviewSvc: OverviewService
  ) {}

  @httpGet("/index-returns")
  public async indexReturns(
    @request() req: Request,
    @response() res: Response
  ) {
    const returnsOrError = await this.overviewSvc.getIndexOverviewReturns();

    const isOverviewError = (value: any): value is string => {
      return typeof value === "string";
    };

    if (isOverviewError(returnsOrError)) {
      res.status(500).json(returnsOrError);
    } else {
      res.json(returnsOrError);
    }
  }

  @httpGet("/movers")
  public movers(@request() req: Request, @response() res: Response) {
    const movers = this.overviewSvc.getDailyMarketMovers();
    res.json(movers);
  }

  @httpGet("/sectors")
  public sectors(@request() req: Request, @response() res: Response) {
    const sectors = this.overviewSvc.getDailySectorOverview();
    res.json(sectors);
  }

  @httpGet("/index/:index/percent-above-sma")
  public async percentAbovesSMA(
    @request() req: Request,
    @response() res: Response,
    @requestParam("index") index: MajorStockIndex,
    //@queryParam("startDate") startDate: string,
    @queryParam("period") period: string
    //@queryParam("endDate") endDate: string
  ) {
    // const start = startDate ? moment(startDate) : new Date(2014, 1, 1);
    //const end = endDate ? moment(endDate) : new Date();

    //const startMillis = start.valueOf();
    //const endMillis = end.valueOf();
    const percentLine = await this.overviewSvc.getCachedPercentAboveSMALine(
      index,
      parseInt(period, 10)
    );
    res.json(percentLine);
  }

  @httpGet("/sectors/:sector/percent-above-sma")
  public async sectorsPercentAbovesSMA(
    @request() req: Request,
    @response() res: Response,
    @requestParam("sector") sector: string,
    @queryParam("period") period: string
  ) {
    const percentLine =
      await this.overviewSvc.getCachedSectorsPercentAboveSMALine(
        sector.toLowerCase(),
        parseInt(period, 10)
      );
    res.json(percentLine);
  }

  @httpGet("/index/:index/advance-decline-line")
  public async advanceDeclineLine(
    @request() req: Request,
    @response() res: Response,
    @requestParam("index") index: MajorStockIndex
  ) {
    const adLine = await this.overviewSvc.getCachedAdvancedDeclineLine(index);
    res.json(adLine);
  }
}
