import { Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  request,
  response,
} from "inversify-express-utils";
import { DailyCacheService } from "../../services/daily_cache_service";
import { OverviewService } from "../../services/overview/overview-service";
import TYPES from "../../types";
import { ETFOverviewPriceReturns } from "./overview-responses";

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
    }

    res.json(returnsOrError);
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
}
