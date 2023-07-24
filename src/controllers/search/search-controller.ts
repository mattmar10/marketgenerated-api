import { NextFunction, Request, Response } from "express";
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
import { DailyCacheService } from "../../services/daily_cache_service";
import { OverviewService } from "../../services/overview/overview-service";
import { SymbolService } from "../../services/symbol_service";
import {
  EtfSymbolResponse,
  SearchResponse,
  StockSymbolResponse,
} from "./search-reponses";

@controller("/search")
export class SearchController {
  constructor(
    @inject(TYPES.DailyCacheService) private cacheSvc: DailyCacheService,
    @inject(TYPES.SymbolService) private symbolSvc: SymbolService
  ) {}

  @httpGet("/:ticker")
  public searchSymbol(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("ticker") ticker: string
  ) {
    const trimmed = ticker.trim().toLocaleLowerCase();
    const stocks = this.symbolSvc.getStocks();
    const etfs = this.symbolSvc.getEtfs();

    const exactStocks: StockSymbolResponse[] = stocks
      .filter((s) => s.symbol.toLocaleLowerCase() === trimmed)
      .map((s) => {
        return {
          symbol: s.symbol,
          name: s.name,
          industry: s.industry,
          sector: s.sector,
        };
      });

    const exactEtfs = etfs
      .filter((e) => e.symbol.toLocaleLowerCase() === trimmed)
      .map((e) => {
        return {
          symbol: e.symbol,
          name: e.companyName,
        };
      });

    const containsStocks: StockSymbolResponse[] = stocks
      .filter((s) => s.symbol.toLowerCase().includes(trimmed))
      .map((s) => {
        return {
          symbol: s.symbol,
          name: s.name,
          industry: s.industry,
          sector: s.sector,
        };
      });

    const containsEtfs: EtfSymbolResponse[] = etfs
      .filter((e) => e.symbol.toLowerCase().includes(trimmed))
      .map((e) => {
        return {
          symbol: e.symbol,
          name: e.companyName,
        };
      });

    const mergedStocks = this.mergeArrays<StockSymbolResponse, string>(
      (s: StockSymbolResponse) => s.symbol,
      exactStocks,
      containsStocks
    );

    const mergedEtfs = this.mergeArrays<EtfSymbolResponse, string>(
      (s: StockSymbolResponse) => s.symbol,
      exactEtfs,
      containsEtfs
    );

    const returnResponse: SearchResponse = {
      stocks: mergedStocks,
      etfs: mergedEtfs,
    };

    res.json(returnResponse);
  }

  private mergeArrays<T, K>(getKey: (element: T) => K, ...arrays: T[][]): T[] {
    const merged: T[] = [];
    const seen = new Set<K>();

    for (const array of arrays) {
      for (const element of array) {
        const key = getKey(element);
        if (!seen.has(key)) {
          merged.push(element);
          seen.add(key);
        }
      }
    }

    return merged;
  }
}
