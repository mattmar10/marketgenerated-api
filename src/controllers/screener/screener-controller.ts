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
import { ZodError, z } from "zod";
import { BollingerBandsScreenerResult } from "../../services/screener/screener-types";

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

  @httpGet("/ema-cross")
  public getEMACross(
    @request() req: Request,
    @response() res: Response,
    @queryParam("minRelativeVolume") minRelativeVolStr: string,
    @queryParam("minClosePrice") minClosePriceStr: string,
    @queryParam("emaPeriod") emaPeriodStr: string
  ) {
    const minRelativeVol: number = parseFloat(minRelativeVolStr);
    const minClosePrice: number = parseFloat(minClosePriceStr);
    const emaPeriod: number = parseInt(emaPeriodStr);
    const results = this.screenerSvc.emaCrossWithVolume(
      emaPeriod,
      minRelativeVol,
      minClosePrice
    );

    return results;
  }

  @httpGet("/launchpad")
  public launchPad(
    @request() req: Request,
    @response() res: Response,
    @queryParam("minClosePrice") minClosePriceStr: string
  ) {
    const minClosePrice: number = parseFloat(minClosePriceStr);
    const results = this.screenerSvc.launchPad(minClosePrice);

    return results;
  }

  @httpGet("/institutional-support")
  public institutionalSupport(
    @request() req: Request,
    @response() res: Response,
    @queryParam("minClosePrice") minClosePriceStr: string
  ) {
    const minClosePrice: number = parseFloat(minClosePriceStr);
    const results = this.screenerSvc.institutionalSupport(minClosePrice);

    return results;
  }

  @httpGet("/mg-leaders")
  public mgLeaders(
    @request() req: Request,
    @response() res: Response,
    @queryParam("minClosePrice") minClosePriceStr: string,
    @queryParam("count") countStr: string
  ) {
    const minClosePrice: number = parseFloat(minClosePriceStr);
    const count: number = parseInt(countStr);
    const results = this.screenerSvc.mgScoreLeaders(minClosePrice, count);

    return results;
  }

  @httpGet("/bollinger-bands/lower-breach")
  public bbBandsLowerBreach(
    @request() req: Request,
    @response() res: Response,
    @queryParam("period") periodStr: string,
    @queryParam("multiplier") multiplierStr: string,
    @queryParam("minClosePrice") minClosePriceStr: string,
    @queryParam("lookback") lookbackStr: string
  ) {
    const queryParamsSchema = z.object({
      period: z.string().refine((val) => !isNaN(parseFloat(val)), {
        message: "Period must be a valid number.",
      }),
      multiplier: z.string().refine((val) => !isNaN(parseFloat(val)), {
        message: "Multiplier must be a valid number.",
      }),
      minClosePrice: z.string().refine((val) => !isNaN(parseFloat(val)), {
        message: "MinClosePrice must be a valid number.",
      }),
      lookback: z.string().refine((val) => !isNaN(parseInt(val)), {
        message: "Lookback must be a valid integer.",
      }),
    });

    try {
      // Parse and validate query parameters
      const { period, multiplier, minClosePrice, lookback } =
        queryParamsSchema.parse({
          period: periodStr,
          multiplier: multiplierStr,
          minClosePrice: minClosePriceStr,
          lookback: lookbackStr,
        });

      const results: BollingerBandsScreenerResult[] =
        this.screenerSvc.bollingerBandsLowerBreach(
          parseInt(period),
          parseFloat(multiplier),
          parseFloat(minClosePrice),
          parseInt(lookback)
        );

      return results;
    } catch (error) {
      if (error instanceof ZodError) {
        // Handle validation errors
        res.status(400).send({
          error: "Validation failed",
          details: error.errors,
        });
      } else {
        // Handle other types of errors
        res.status(500).send({ error: "Internal Server Error" });
      }
    }
  }
}
