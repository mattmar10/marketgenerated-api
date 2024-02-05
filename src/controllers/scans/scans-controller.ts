import TYPES from "../../types";
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
import { ScanService } from "../../services/scan/scan-service";
import { ScanResultsWithRows } from "../../services/scan/scan-types";
@controller("/scans")
export class ScansController {
  constructor(@inject(TYPES.ScanService) private scanService: ScanService) {}

  @httpGet("/predefined")
  public getScanInfos(@request() req: Request, @response() res: Response) {
    const scans = this.scanService.getPredefinedScans();
    return scans;
  }

  @httpGet("/:scanId/latest")
  public getScanResults(
    @request() req: Request,
    @response() res: Response,
    @requestParam("scanId") scanId: string
  ) {
    const scans: ScanResultsWithRows | undefined =
      this.scanService.getLatestScanResults(scanId);
    if (scans === undefined) {
      res.status(404).send(`Scan ${scanId} not found`);
    } else {
      return scans;
    }
  }
}
