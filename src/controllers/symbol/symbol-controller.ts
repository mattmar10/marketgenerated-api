import { NextFunction, Request, Response, json } from "express";
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
import {
  PeriodType,
  SymbolService,
  SymbolServiceError,
} from "../../services/symbol/symbol_service";
import { Either, match } from "../../MarketGeneratedTypes";
import {
  FmpIncomeStatementList,
  FmpNewsList,
  Quote,
  SymbolProfile,
} from "../../services/symbol/symbol-types";
import { FMPProfile } from "../../services/financial_modeling_prep_types";
import * as z from "zod";

import { ZodParsedType } from "zod";

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
            currency: profileResp.value.currency,
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

  @httpGet("/:ticker/quote")
  public async quote(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string
  ) {
    const trimmed = ticker.trim().toUpperCase();

    if (!trimmed || trimmed.length == 0) {
      res.status(400).send();
    } else {
      const profileResp: Either<SymbolServiceError, Quote> =
        await this.symbolService.getQuoteForSymbol(ticker);

      switch (profileResp.tag) {
        case "left":
          res.status(500).json({ error: profileResp.value });
          break;

        case "right":
          res.json(profileResp.value);

          break;
      }
    }
  }

  @httpGet("/:ticker/news")
  public async news(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string
  ) {
    const trimmed = ticker.trim().toUpperCase();

    if (!trimmed || trimmed.length == 0) {
      res.status(400).send();
    } else {
      const newsResp: Either<SymbolServiceError, FmpNewsList> =
        await this.symbolService.getNewsForSymbol(ticker);

      match(
        newsResp,
        (error) => {
          console.error(`Error getting news for ${ticker} ${error}`);
          res.status(500).json({ error: error });
        },
        (news) => {
          res.json(news);
        }
      );
    }
  }

  @httpGet("/:ticker/income-statement")
  public async incomeStatement(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string,
    @queryParam("period") period: string,
    @queryParam("limit") limit: string
  ) {
    const trimmed = ticker.trim().toUpperCase();

    const validateQueryParams = (period: string, limit: string): boolean => {
      const periodSchema = z.enum(["quarter", "year"]);
      const limitSchema = z.string().regex(/^\d+$/).min(1).max(10);

      const parsedPeriod = periodSchema.safeParse(period);
      const parsedLimit = limitSchema.safeParse(limit);

      if (!parsedPeriod.success) {
        return false;
      }

      if (!parsedLimit.success) {
        return false;
      }

      return true;
    };

    if (
      !trimmed ||
      trimmed.length == 0 ||
      !validateQueryParams(period, limit)
    ) {
      res.status(400).send();
    } else {
      const incomeStatementResp: Either<
        SymbolServiceError,
        FmpIncomeStatementList
      > = await this.symbolService.getIncomeStatementForSymbol(
        ticker,
        period as PeriodType,
        Number(limit)
      );

      match(
        incomeStatementResp,
        (error) => {
          console.error(
            `Error getting income statement for ${ticker} ${error}`
          );
          res.status(500).json({ error: error });
        },
        (news) => {
          res.json(news);
        }
      );
    }
  }
}
