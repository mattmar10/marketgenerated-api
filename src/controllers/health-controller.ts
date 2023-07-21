import { NextFunction, Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  next,
  request,
  response,
} from "inversify-express-utils";

@controller("/health")
export class HealthController {
  constructor() {}

  @httpGet("/")
  public health(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    const data = {
      status: "healthy",
    };

    res.json(data);
  }
}
