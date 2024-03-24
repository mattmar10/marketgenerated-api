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
import { TableResponseRow } from "../../services/response-types";
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

  @httpGet("/volume-surge-candidates")
  public getVolumeSurgeCandidates(
    @request() req: Request,
    @response() res: Response
  ) {
    const scanIds: string[] = [
      "matts-recipe",
      "mr-q-recipe",
      "the-winning-team",
      "ants",
    ];

    const stockResults: TableResponseRow[] = [];
    const etfResults: TableResponseRow[] = [];

    const resultsOfScans = scanIds.map((s) =>
      this.scanService.getLatestScanResults(s)
    );

    resultsOfScans.forEach((sr) => {
      sr?.stocks.forEach((s) => {
        if (
          s.rsRankFromSlope &&
          !stockResults.find((sr) => sr.ticker === s.ticker)
        ) {
          stockResults.push(s);
        }
      });
      sr?.etfs.forEach((e) => {
        if (
          e.rsRankFromSlope &&
          !etfResults.find((er) => er.ticker === e.ticker)
        ) {
          etfResults.push(e);
        }
      });
    });

    const result: ScanResultsWithRows = {
      scanId: "volume-surge-candidates",
      completionTime: new Date().toString(),
      scanName: "volume-surge-candidates",
      description: "Composite volume surge scan",
      etfs: etfResults,
      stocks: stockResults,
    };

    return result;
  }

  @httpGet("/results")
  public async getHistoricalScanResults(
    @request() req: Request,
    @response() res: Response,
    @queryParam("ticker") ticker: string
  ) {
    const scans = await this.scanService.getScanResultsForTicker(ticker);
    if (scans === undefined) {
      res.status(404).send(`not found`);
    } else {
      return scans;
    }
  }
}
