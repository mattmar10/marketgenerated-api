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
import { VolumeSurgeService } from "../../services/volume-surge/volume-surge-service";

@controller("/volume-surge")
export class VolumeSurgeController {
  constructor(
    @inject(TYPES.VolumeSurgeService)
    private volumeSurgeService: VolumeSurgeService
  ) {}

  @httpGet("/candidates")
  public getLeadersByTimePeriod(
    @request() req: Request,
    @response() res: Response
  ) {
    const result = this.volumeSurgeService.getCurrentVolumeSurgeCandidates();

    res.json(result);
  }
}
