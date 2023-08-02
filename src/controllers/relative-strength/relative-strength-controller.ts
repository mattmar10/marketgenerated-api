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

  @httpGet("/leaders/composite")
  public getCompositeRSLeaders(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @queryParam("count") count: number
  ) {
    const result =
      this.relativeStrengthSvc.getTopCompositeRelativeStrengthPerformers(count);

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

    if (isRelativeStrengthsForSymbol(result)) {
      res.json(result);
    } else {
      console.log(`Error getting relative strength for ${symbol}`);
      res.status(400).send();
    }
  }
}
