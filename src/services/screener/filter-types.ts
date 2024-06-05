import { Ticker } from "../../MarketGeneratedTypes";

enum FilterOperation {
  EQUALS = "equals",
  NOT_EQUALS = "notEquals",
  GREATER_THAN = "greaterThan",
  LESS_THAN = "lessThan",
}

interface FilterCriteria<V> {
  valueExtractor: (ticker: Ticker) => V;
  operation: FilterOperation;
  value: V;
}

function applyFilter<V>(ticker: Ticker, criteria: FilterCriteria<V>): boolean {
  const itemValue: V = criteria.valueExtractor(ticker);

  switch (criteria.operation) {
    case FilterOperation.EQUALS:
      return itemValue === criteria.value;
    case FilterOperation.NOT_EQUALS:
      return itemValue !== criteria.value;
    case FilterOperation.GREATER_THAN:
      return itemValue > criteria.value;
    case FilterOperation.LESS_THAN:
      return itemValue < criteria.value;
    default:
      return false;
  }
}

function filterEngine(
  tickers: Ticker[],
  criteria: FilterCriteria<any>[]
): Ticker[] {
  return criteria.reduce((filteredTickers, criterion) => {
    return filteredTickers.filter((ticker) => applyFilter(ticker, criterion));
  }, tickers);
}

export interface FilterDTO {
  field: string; // The field to filter on, e.g., 'price', 'volume'
  operation: FilterOperation;
  value: any; // The value to compare against
}
