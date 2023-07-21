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
import { OverviewService } from "../../services/overview/overview-service";
import {
  ETFHoldingPriceReturn,
  ETFOverviewPriceReturns,
} from "./overview-responses";

@controller("/overview")
export class OverviewController {
  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.OverviewService) private overviewSvc: OverviewService
  ) {}

  @httpGet("/returns")
  public returns(@request() req: Request, @response() res: Response) {
    const etfHoldingReturns: ETFOverviewPriceReturns =
      this.overviewSvc.getOverviewReturns();

    res.json(etfHoldingReturns);
  }

  @httpGet("/movers")
  public movers(@request() req: Request, @response() res: Response) {
    const movers = this.overviewSvc.getDailyMarketMovers();
    res.json(movers);
  }
}
