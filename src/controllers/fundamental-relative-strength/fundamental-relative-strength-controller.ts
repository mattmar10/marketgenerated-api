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
import { NextFunction, Request, Response } from "express";

import { FundamentalRelativeStrengthService } from "../../services/fundamental-relative-strength/funamental-relative-strength-service";
import TYPES from "../../types";

@controller("/fundamental-relative-strength")
export class FundamentalRelativeStrengthController {
  constructor(
    @inject(TYPES.FundamentalRelativeStrengthService)
    private fundamentalRelativeStrenghService: FundamentalRelativeStrengthService
  ) {}

  @httpGet("/symbol/:ticker")
  public getFundamentalRelativeStrengthForSymbol(
    @request() req: Request,
    @response() res: Response,
    @requestParam("ticker") ticker: string // Add this line
  ) {
    const result =
      this.fundamentalRelativeStrenghService.getFundamentalRankAndScoreForSymbol(
        ticker
      );

    if (result) {
      res.json(result);
    }
  }

  @httpGet("/leaders")
  public getFundamentalRelativeStrengthLeaders(
    @request() req: Request,
    @response() res: Response,
    @queryParam("count") count: string
  ) {
    const num = parseInt(count);

    const topEtfs =
      this.fundamentalRelativeStrenghService.getTopEtfFundamentalRelativeStrengthPerformers(
        num
      );
    const topStocks =
      this.fundamentalRelativeStrenghService.getTopStockFundamentalRelativeStrengthPerformers(
        num
      );

    const toReturn = {
      stocks: topStocks,
      etfs: topEtfs,
    };

    res.json(toReturn);
  }
}
