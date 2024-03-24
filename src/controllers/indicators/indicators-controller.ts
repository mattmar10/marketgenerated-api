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
import { ZodError, z } from "zod";
import { IndicatorsService } from "../../services/indicator/indicator-service";
import TYPES from "../../types";
import { match } from "../../MarketGeneratedTypes";

@controller("/indicators")
export class IndicatorController {
  constructor(
    @inject(TYPES.IndicatorService) private indicatorSvc: IndicatorsService
  ) {}

  @httpGet("/:ticker/beta")
  public getBeta(
    @request() req: Request,
    @response() res: Response,
    @requestParam("ticker") ticker: string,
    @queryParam("period") periodStr: string
  ) {
    const schema = z.object({
      period: z.string().refine((val) => !isNaN(parseFloat(val)), {
        message: "Period must be a valid number.",
      }),
    });

    try {
      const { period } = schema.parse({
        period: periodStr,
      });

      const betaResults = this.indicatorSvc.beta(ticker, parseInt(period));
      return betaResults;
    } catch (error) {
      if (error instanceof ZodError) {
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

  @httpGet("/:ticker/beta-series")
  public getBetaSeries(
    @request() req: Request,
    @response() res: Response,
    @requestParam("ticker") ticker: string,
    @queryParam("period") periodStr: string,
    @queryParam("startDate") startDateStr: string
  ) {
    const schema = z.object({
      period: z.string().refine((val) => !isNaN(parseFloat(val)), {
        message: "Period must be a valid number.",
      }),
      startDate: z
        .string()
        .optional()
        .default(() => {
          const today = new Date();
          const oneYearAgo = new Date(
            today.getFullYear() - 1,
            today.getMonth(),
            today.getDate()
          );
          return oneYearAgo.toISOString().split("T")[0];
        })
        .refine(
          (val) => {
            const regex = /^\d{4}-\d{2}-\d{2}$/;
            return regex.test(val);
          },
          { message: "Date must be in yyyy-mm-dd format." }
        )
        .transform((val) => new Date(val))
        .refine((val) => !isNaN(val.getTime()), { message: "Invalid date." }),
    });

    try {
      const { period, startDate } = schema.parse({
        period: periodStr,
        startDate: startDateStr,
      });

      const betaResults = this.indicatorSvc.betaSequence(
        ticker,
        startDate,
        parseInt(period)
      );

      return betaResults.value;
    } catch (error) {
      if (error instanceof ZodError) {
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

  @httpGet("/:ticker/avwap")
  public async getAVwap(
    @request() req: Request,
    @response() res: Response,
    @requestParam("ticker") ticker: string,
    @queryParam("startDate") startDateStr: string
  ) {
    const schema = z.object({
      startDate: z
        .string()
        .optional()
        .default(() => {
          const today = new Date();
          const oneYearAgo = new Date(
            today.getFullYear() - 1,
            today.getMonth(),
            today.getDate()
          );
          return oneYearAgo.toISOString().split("T")[0];
        })
        .refine(
          (val) => {
            const regex = /^\d{4}-\d{2}-\d{2}$/;
            return regex.test(val);
          },
          { message: "Date must be in yyyy-mm-dd format." }
        )
        .transform((val) => new Date(val))
        .refine((val) => !isNaN(val.getTime()), { message: "Invalid date." }),
    });

    try {
      const { startDate } = schema.parse({
        startDate: startDateStr,
      });

      const avwapSeries = await this.indicatorSvc.anchoredVWAP(
        ticker,
        startDateStr
      );

      return avwapSeries.value;
    } catch (error) {
      if (error instanceof ZodError) {
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

  @httpGet("/:ticker/avwape")
  public async getAVwapEarnings(
    @request() req: Request,
    @response() res: Response,
    @requestParam("ticker") ticker: string
  ) {
    if (!ticker) {
      res.status(400).send();
    } else {
      try {
        const avwapE = await this.indicatorSvc.anchoredVWAPE(ticker);

        match(
          avwapE,
          (err) => res.status(500).send({ error: err.message }),
          (results) => res.json(results)
        );
      } catch (error) {
        res.status(500).send({ error: "Internal Server Error" });
      }
    }
  }
}
