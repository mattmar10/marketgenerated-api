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

@controller("/indicators")
export class IndicatorController {
  constructor(
    @inject(TYPES.IndicatorsService) private indicatorSvc: IndicatorsService
  ) {}

  @httpGet("/:ticker/atr")
  public getTrendFilter(
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

      const atrResults = this.indicatorSvc.atr(ticker, parseInt(period));
      return atrResults;
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
}
