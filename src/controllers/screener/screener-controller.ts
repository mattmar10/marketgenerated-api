import { Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  request,
  response,
} from "inversify-express-utils";
import { ScreenerService } from "../../services/screener/screener-service";
import TYPES from "../../types";

@controller("/screener")
export class ScreenerController {
  constructor(
    @inject(TYPES.ScreenerService) private screenerSvc: ScreenerService
  ) {}

  @httpGet("/trend-filter")
  public getTrendFilter(@request() req: Request, @response() res: Response) {
    const trendFilterResults = this.screenerSvc.getTrendTemplateResults();
    res.json(trendFilterResults);
  }
}
