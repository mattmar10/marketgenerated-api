import {
  RelativeStrengthError,
  RelativeStrengthsForSymbol,
  isRelativeStrengthTimePeriod,
} from "../../services/relative-strength/relative-strength-types";
import { NextFunction, Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  request,
  next,
  response,
  requestParam,
  queryParam,
} from "inversify-express-utils";
import TYPES from "../../types";
import { symbol } from "zod";
import { RelativeStrengthService } from "../../services/relative-strength/relative-strength-service";

@controller("/relative-strength")
export class RelativeStrengthController {
  constructor(
    @inject(TYPES.RelativeStrengthService)
    private relativeStrengthSvc: RelativeStrengthService
  ) {}

  @httpGet("/leaders/period/:timePeriod")
  public getLeadersByTimePeriod(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("timePeriod") timePeriod: string,
    @queryParam("count") count: number
  ) {
    if (!timePeriod || !isRelativeStrengthTimePeriod(timePeriod) || !count) {
      res.status(400).send();
    } else {
      const result =
        this.relativeStrengthSvc.getTopRelativeStrengthPerformersForTimePeriod(
          timePeriod,
          count
        );

      res.json(result);
    }
  }

  @httpGet("/leaders-rsline/period/:timePeriod")
  public getLeadersBySlopeByTimePeriod(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("timePeriod") timePeriod: string,
    @queryParam("count") count: string = "100",
    @queryParam("minRSScore") minRSscore: string = "80",
    @queryParam("assetType") assetType: string,
    @queryParam("industryGroup") industryGroup: string,
    @queryParam("sector") sector: string
  ) {
    if (
      !timePeriod ||
      !isRelativeStrengthTimePeriod(timePeriod) ||
      !count ||
      !(assetType == "stocks" || assetType == "etfs")
    ) {
      res.status(400).send();
    } else {
      const result =
        this.relativeStrengthSvc.getRelativeStrengthLeadersForTimePeriodFromRSLine(
          Number(count),
          Number(minRSscore),
          timePeriod,
          assetType,
          industryGroup,
          sector
        );

      res.json(result);
    }
  }

  @httpGet("/industry-groups")
  public getAvgIndustyGroupRelativeStrengths(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    const result = this.relativeStrengthSvc.getAvgIndustryRelativeStrengths();

    res.json(result);
  }

  @httpGet("/leaders/composite")
  public getCompositeRSLeaders(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @queryParam("count") count: number
  ) {
    console.log("getting relative strength composite score leaders");
    const result =
      this.relativeStrengthSvc.getTopCompositeRelativeStrengthPerformers(count);

    res.json(result);
  }

  @httpGet("/leaders/strength")
  public getRSLineLeaders(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @queryParam("count") count: number,
    @queryParam("industryGroup") industryGroup: string,
    @queryParam("sector") sector: string
  ) {
    console.log("getting relative strength line leaders");

    const result = this.relativeStrengthSvc.getRelativeStrengthLineLeaders(
      count,
      industryGroup,
      sector
    );

    res.json(result);
  }

  @httpGet("/:ticker")
  public getRelativeStrengthForSymbol(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string
  ) {
    function isRelativeStrengthsForSymbol(
      data: RelativeStrengthsForSymbol | RelativeStrengthError
    ): data is RelativeStrengthsForSymbol {
      return typeof data !== "string";
    }

    const result =
      this.relativeStrengthSvc.getRelativeStrengthsForSymbol(ticker);

    const fromSlope =
      this.relativeStrengthSvc.getRelativeStrengthFromSlope(ticker);

    if (isRelativeStrengthsForSymbol(result)) {
      result.relativeStrengthsFromSlope = fromSlope;
      res.json(result);
    } else {
      console.log(`Error getting relative strength for ${ticker}`);
      res.status(400).send();
    }
  }
}
