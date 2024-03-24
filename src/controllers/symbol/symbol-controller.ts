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
  SymbolService,
  SymbolServiceError,
} from "../../services/symbol/symbol_service";
import { Either, match } from "../../MarketGeneratedTypes";
import {
  FmpIncomeStatementList,
  FmpNewsList,
  PeriodType,
  Quote,
  SymbolFundamentalChangesStats,
  SymbolFundamentalsStats,
  SymbolProfile,
} from "../../services/symbol/symbol-types";
import {
  FMPEarningsCalendar,
  FMPProfile,
} from "../../services/financial_modeling_prep_types";

import * as z from "zod";
import { DailyCacheService } from "../../services/daily_cache_service";

@controller("/symbol")
export class SymbolController {
  constructor(
    @inject(TYPES.SymbolService) private symbolService: SymbolService,
    @inject(TYPES.DailyCacheService) private cacheService: DailyCacheService
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
            industry: profileResp.value.industry || "",
            sector: profileResp.value.sector,
            website: profileResp.value.website || "",
            description: profileResp.value.description,
            isEtf: profileResp.value.isEtf,
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
      const quoteResp: Either<SymbolServiceError, Quote> =
        await this.symbolService.getQuoteForSymbol(ticker);

      switch (quoteResp.tag) {
        case "left":
          res.status(500).json({ error: quoteResp.value });
          break;

        case "right":
          res.json(quoteResp.value);

          break;
      }
    }
  }

  @httpGet("/:ticker/earnings")
  public async earnings(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string,
    @queryParam("limit") limit: string
  ) {
    const trimmed = ticker.trim().toUpperCase();

    const validateQueryParams = (limit: string): boolean => {
      const limitSchema = z.string().regex(/^\d+$/).min(1).max(10);
      const parsedLimit = limitSchema.safeParse(limit);
      if (!parsedLimit.success) {
        return false;
      }

      return true;
    };

    if (!trimmed || trimmed.length == 0 || !validateQueryParams(limit)) {
      res.status(400).send();
    } else {
      const earningsResp: Either<SymbolServiceError, FMPEarningsCalendar> =
        await this.symbolService.getEarningsCalendarForSymbol(
          ticker,
          Number(limit)
        );

      match(
        earningsResp,
        (error) => {
          console.error(`Error getting earnings for ${ticker} ${error}`);
          res.status(500).json({ error: error });
        },
        (earnings) => {
          res.json(earnings);
        }
      );
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

  @httpGet("/:ticker/fundamental-stats")
  public async fundamentalStats(
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
      const fundamentalsResp: Either<
        SymbolServiceError,
        SymbolFundamentalsStats
      > = await this.symbolService.getFundamentalStatsForSymbol(
        ticker,
        period as PeriodType,
        Number(limit)
      );

      match(
        fundamentalsResp,
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

  @httpGet("/:ticker/fundamental-changes-stats")
  public async fundamentalChangesStats(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string,
    @queryParam("period") period: string
  ) {
    const trimmed = ticker.trim().toUpperCase();

    const validateQueryParams = (period: string): boolean => {
      const periodSchema = z.enum(["quarter", "year"]);

      const parsedPeriod = periodSchema.safeParse(period);

      if (!parsedPeriod.success) {
        return false;
      }

      return true;
    };

    if (!trimmed || trimmed.length == 0 || !validateQueryParams(period)) {
      res.status(400).send();
    } else {
      const fundamentalChangesResp: Either<
        SymbolServiceError,
        SymbolFundamentalChangesStats
      > = await this.symbolService.getFundamentalChangeStatsForSymbol(
        ticker,
        period as PeriodType
      );

      match(
        fundamentalChangesResp,
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
