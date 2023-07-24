export interface StockSymbolResponse {
  symbol: string;
  name: string;
  industry: string;
  sector: string;
}

export interface EtfSymbolResponse {
  symbol: string;
  name: string;
}

export interface SearchResponse {
  stocks: StockSymbolResponse[];
  etfs: EtfSymbolResponse[];
}
