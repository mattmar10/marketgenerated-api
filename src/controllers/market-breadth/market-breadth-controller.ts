import { Request, Response } from "express";
import { inject } from "inversify";
import TYPES from "../../types";
import {
  controller,
  httpGet,
  queryParam,
  request,
  requestParam,
  response,
} from "inversify-express-utils";
import { DailyCacheService } from "../../services/daily_cache_service";
import { MarketBreadthService } from "../../services/breadth/market-breadth-service";
import { MarketBreadthResponse } from "../overview/overview-responses";

@controller("/breadth")
export class MarketBreadthController {
  constructor(
    @inject(TYPES.MarketBreadthService)
    private breadthService: MarketBreadthService
  ) {}

  @httpGet("/advance-decline")
  public movers(@request() req: Request, @response() res: Response) {
    const overview = this.breadthService.getRealtimeMarketBreadthOverview(
      this.breadthService.getCachedMarketBreadtOverview()
    );
    res.json(overview.advanceDeclineLine);
  }

  @httpGet("/overview")
  public marketBreadth(@request() req: Request, @response() res: Response) {
    const resp = {
      marketBreadthOverview:
        this.breadthService.getRealtimeMarketBreadthOverview(
          this.breadthService.getCachedMarketBreadtOverview()
        ),
      generalMarketOverview: this.breadthService.getGeneralMarketOverview(),
    };
    res.json(resp);
  }

  @httpGet("/overview/snapshot")
  public marketBreadthSnapshot(
    @request() req: Request,
    @response() res: Response
  ) {
    const resp = this.breadthService.getMarketBreadthSnapshot();
    res.json(resp);
  }

  @httpGet("/overview/exchange/:exchangeName")
  public marketBreadthExchange(
    @request() req: Request,
    @requestParam("exchangeName") exchangeName: string,
    @response() res: Response
  ) {
    if (exchangeName === "nyse" || exchangeName === "nasdaq") {
      const marketBreadthOverview =
        this.breadthService.getExchangeMarketBreadthOverview(exchangeName);

      if (marketBreadthOverview) {
        const resp: MarketBreadthResponse = {
          marketBreadthOverview,
          generalMarketOverview: this.breadthService.getGeneralMarketOverview(),
        };
        res.json(resp);
      } else {
        res.status(404).send();
      }
    } else {
      res.status(400).send();
    }
  }

  @httpGet("/overview/sector/:sectorName")
  public marketBreadthSector(
    @request() req: Request,
    @requestParam("sectorName") sectorName: string,
    @response() res: Response
  ) {
    const overview =
      this.breadthService.getSectorMarketBreadthOvervew(sectorName);

    if (!overview) {
      res.status(404).send();
    } else {
      const resp: MarketBreadthResponse = {
        marketBreadthOverview: overview,
        generalMarketOverview: this.breadthService.getGeneralMarketOverview(),
      };
      res.json(resp);
    }
  }
}
