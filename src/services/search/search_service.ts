import { inject, injectable } from "inversify";

import { EtfSymbol, StockSymbol, SymbolService } from "../symbol_service";
import TYPES from "../../types";
import {
  EtfSymbolResponse,
  SearchResponse,
  StockSymbolResponse,
} from "../../controllers/search/search-reponses";

@injectable()
export class SearchService {
  constructor(@inject(TYPES.SymbolService) private symbolSvc: SymbolService) {}

  public basicSearch(query: string): SearchResponse {
    const trimmed = query.trim().toLocaleLowerCase();
    const stocks = this.symbolSvc.getStocks();
    const etfs = this.symbolSvc.getEtfs();

    //only search the ticker for exact matches (e.g, F, T, X, etc... )
    if (trimmed.length == 1) {
      const exactStocks: StockSymbolResponse[] =
        this.genericFilter<StockSymbol>(query, stocks, (s) => s.symbol);

      const exactEtfs: EtfSymbolResponse[] = this.genericFilter<EtfSymbol>(
        query,
        etfs,
        (e) => e.symbol
      ).map((e) => {
        return {
          symbol: e.symbol,
          name: e.companyName,
        };
      });

      const returnResponse: SearchResponse = {
        stocks: exactStocks,
        etfs: exactEtfs,
      };

      return returnResponse;
    } else {
      const stockTickerResults: StockSymbolResponse[] =
        this.genericFilter<StockSymbol>(query, stocks, (s) => s.symbol, true);

      const stockNameResults: StockSymbolResponse[] =
        this.genericFilter<StockSymbol>(query, stocks, (s) => s.name, true);

      const etfTickerResults: EtfSymbolResponse[] =
        this.genericFilter<EtfSymbol>(query, etfs, (e) => e.symbol, true).map(
          (e) => {
            return {
              symbol: e.symbol,
              name: e.companyName,
            };
          }
        );

      const etfNameResults: EtfSymbolResponse[] = this.genericFilter<EtfSymbol>(
        query,
        etfs,
        (e) => e.companyName,
        true
      ).map((e) => {
        return {
          symbol: e.symbol,
          name: e.companyName,
        };
      });

      const mergedStocks = this.mergeArrays<StockSymbolResponse, string>(
        (s: StockSymbolResponse) => s.symbol,
        stockTickerResults,
        stockNameResults
      );

      const mergedEtfs = this.mergeArrays<EtfSymbolResponse, string>(
        (s: StockSymbolResponse) => s.symbol,
        etfTickerResults,
        etfNameResults
      );

      const returnResponse: SearchResponse = {
        stocks: mergedStocks,
        etfs: mergedEtfs,
      };

      return returnResponse;
    }
  }

  private genericFilter<T>(
    query: string,
    data: T[],
    getValue: (item: T) => string,
    includeContainsResults: boolean = false
  ): T[] {
    const exactMatches: T[] = data.filter(
      (item) => getValue(item).toLowerCase() === query.toLocaleLowerCase()
    );
    var containsMatches: T[] = [];

    if (includeContainsResults) {
      containsMatches = data.filter(
        (item) =>
          getValue(item)?.toLowerCase().includes(query.toLowerCase()) || false
      );
    }
    return this.mergeArrays<T, string>(getValue, exactMatches, containsMatches);
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
