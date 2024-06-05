import { NextFunction, Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  request,
  next,
  response,
} from "inversify-express-utils";
import { RotationalStrategy } from "../../services/strategy/rotational-strategy";
import TYPES from "../../types";

@controller("/rotational-strategy")
export class RotationalStrategyController {
  constructor(
    @inject(TYPES.RotationalStrategy)
    private rotationalStrategy: RotationalStrategy
  ) {}

  @httpGet("/sp500")
  public getLeadersByTimePeriod(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    const result = this.rotationalStrategy.getSP500RotationalValues();

    res.json(result);
  }
}
