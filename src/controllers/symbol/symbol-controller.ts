import { NextFunction, Request, Response, json } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  next,
  request,
  requestParam,
  response,
} from "inversify-express-utils";
import TYPES from "../../types";
import {
  SymbolService,
  SymbolServiceError,
} from "../../services/symbol/symbol_service";
import { Either, match } from "../../MarketGeneratedTypes";
import { SymbolProfile } from "../../services/symbol/symbol-types";
import { FMPProfile } from "../../services/financial_modeling_prep_types";

@controller("/symbol")
export class SymbolController {
  constructor(
    @inject(TYPES.SymbolService) private symbolService: SymbolService
  ) {}

  @httpGet("/:ticker/profile")
  public async searchSymbol(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string
  ) {
    const trimmed = ticker.trim().toUpperCase();

    if (!trimmed || trimmed.length == 0) {
      res.status(400).send();
    } else {
      const profileResp: Either<SymbolServiceError, FMPProfile> =
        await this.symbolService.getProfileForSymbol(ticker);

      switch (profileResp.tag) {
        case "left":
          res.status(500).json({ error: profileResp.value });
          break;

        case "right":
          const resp: SymbolProfile = {
            symbol: profileResp.value.symbol,
            mktCap: profileResp.value.mktCap,
            companyName: profileResp.value.companyName,
            industry: profileResp.value.industry,
            sector: profileResp.value.sector,
            website: profileResp.value.website,
            description: profileResp.value.description,
          };

          res.json(resp);

          break;
      }
    }
  }
}
