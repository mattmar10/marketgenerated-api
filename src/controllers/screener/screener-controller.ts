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
import { ScreenerService } from "../../services/screener/screener-service";
import TYPES from "../../types";

@controller("/screener")
export class ScreenerController {
  constructor(
    @inject(TYPES.ScreenerService) private screenerSvc: ScreenerService
  ) {}

  @httpGet("/trend-filter")
  public getTrendFilter(@request() req: Request, @response() res: Response) {
    const trendFilterResults =
      this.screenerSvc.getLongTermTrendTemplateResults();
    return trendFilterResults;
  }

  @httpGet("/fast-trend-filter")
  public getFastTrendFilter(
    @request() req: Request,
    @response() res: Response
  ) {
    const trendFilterResults =
      this.screenerSvc.getShortTermTrendTemplateResults();
    return trendFilterResults;
  }

  @httpGet("/gap-up-on-volume")
  public getGapUpOnVolume(
    @request() req: Request,
    @response() res: Response,
    @queryParam("minGapPercent") gapPercentStr: string,
    @queryParam("minAvgVolume") minAvgVolStr: string,
    @queryParam("minRelativeVolume") minRelativeVolStr: string,
    @queryParam("minClosePrice") minClosePriceStr: string
  ) {
    const gapPercent: number = parseFloat(gapPercentStr);
    const minAvgVol: number = parseFloat(minAvgVolStr);
    const minRelativeVol: number = parseFloat(minRelativeVolStr);
    const minClosePrice: number = parseFloat(minClosePriceStr);

    const gapUpResults = this.screenerSvc.gapUpOnVolume(
      gapPercent,
      minAvgVol,
      minRelativeVol,
      minClosePrice
    );
    return gapUpResults;
  }

  @httpGet("/ema-jumpers")
  public getEMAJumpers(
    @request() req: Request,
    @response() res: Response,
    @queryParam("minRelativeVolume") minRelativeVolStr: string,
    @queryParam("minClosePrice") minClosePriceStr: string
  ) {
    const minRelativeVol: number = parseFloat(minRelativeVolStr);
    const minClosePrice: number = parseFloat(minClosePriceStr);
    const results = this.screenerSvc.emaJumpers(minRelativeVol, minClosePrice);

    return results;
  }
}
