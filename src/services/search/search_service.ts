import { inject, injectable } from "inversify";

import {
  EtfSymbol,
  StockSymbol,
  SymbolService,
} from "../symbol/symbol_service";
import TYPES from "../../types";
import {
  EtfSymbolResponse,
  SearchResponse,
  StockSymbolResponse,
} from "../../controllers/search/search-reponses";
import { FMPSymbolProfileData } from "../financial_modeling_prep_types";
import { isString } from "../../utils/basic_utils";

@injectable()
export class SearchService {
  constructor(@inject(TYPES.SymbolService) private symbolSvc: SymbolService) {}

  public basicSearch(query: string): SearchResponse {
    const trimmed = query.trim().toLowerCase();
    const stocks = this.symbolSvc.getStocks();
    const etfs = this.symbolSvc.getEtfs();

    //only search the ticker for exact matches (e.g, F, T, X, etc... )
    if (trimmed.length == 1) {
      const exactStocks: StockSymbolResponse[] =
        this.genericFilter<FMPSymbolProfileData>(
          query,
          stocks,
          (s) => s.Symbol
        ).map((fmpData) => {
          const res: StockSymbolResponse = {
            symbol: fmpData.Symbol,
            name: fmpData.companyName,
            industry: fmpData.industry ? fmpData.industry : "",
            sector: fmpData.sector ? fmpData.sector : "",
          };

          return res;
        });

      const exactEtfs: EtfSymbolResponse[] =
        this.genericFilter<FMPSymbolProfileData>(
          query,
          etfs,
          (e) => e.Symbol
        ).map((e) => {
          return {
            symbol: e.Symbol,
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
        this.genericFilter<FMPSymbolProfileData>(
          query,
          stocks,
          (s) => s.Symbol,
          true
        ).map((fmpData) => {
          const res: StockSymbolResponse = {
            symbol: fmpData.Symbol,
            name: fmpData.companyName,
            industry: fmpData.industry ? fmpData.industry : "",
            sector: fmpData.sector ? fmpData.sector : "",
          };

          return res;
        });

      const stockNameResults: StockSymbolResponse[] =
        this.genericFilter<FMPSymbolProfileData>(
          query,
          stocks,
          (s) => s.companyName,
          true
        ).map((fmpData) => {
          const res: StockSymbolResponse = {
            symbol: fmpData.Symbol,
            name: fmpData.companyName,
            industry: fmpData.industry ? fmpData.industry : "",
            sector: fmpData.sector ? fmpData.sector : "",
          };

          return res;
        });

      const etfTickerResults: EtfSymbolResponse[] =
        this.genericFilter<FMPSymbolProfileData>(
          query,
          etfs,
          (e) => e.Symbol,
          true
        ).map((e) => {
          return {
            symbol: e.Symbol,
            name: e.companyName,
          };
        });

      const etfNameResults: EtfSymbolResponse[] =
        this.genericFilter<FMPSymbolProfileData>(
          query,
          etfs,
          (e) => e.companyName,
          true
        ).map((e) => {
          return {
            symbol: e.Symbol,
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
    const exactMatches: T[] = data.filter((item) => {
      const value = getValue(item);
      if (isString(value)) {
        return value.toLowerCase() === query.toLowerCase();
      } else {
        return false;
      }
    });
    var containsMatches: T[] = [];

    if (includeContainsResults) {
      containsMatches = data.filter((item) => {
        const value = getValue(item);
        if (isString(value)) {
          return value.toLowerCase().includes(query.toLowerCase()) || false;
        } else {
          return false;
        }
      });
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
