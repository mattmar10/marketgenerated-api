import { Ticker } from "../MarketGeneratedTypes";
import { filterCandlesPastMonths } from "../indicators/indicator-utils";
import { Candle } from "../modles/candle";

export function sortCandlesByDate(candles: Candle[]): Candle[] {
  const sorted = [...candles].sort((a, b) => {
    if (a.date > b.date) {
      return 1;
    } else if (a.date < b.date) {
      return -1;
    }
    return 0;
  });

  return sorted;
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function slidingWindow<T>(array: T[], windowSize: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i <= array.length - windowSize; i++) {
    result.push(array.slice(i, i + windowSize));
  }
  return result;
}

export function sortMapByValue<K, V>(map: Map<K, V>): Map<K, V> {
  const sortedEntries = [...map.entries()].sort((a, b) => {
    // Compare the values of the entries
    if (a[1] < b[1]) {
      return -1; // Value of 'a' is smaller
    } else if (a[1] > b[1]) {
      return 1; // Value of 'a' is larger
    }
    return 0; // Values are equal
  });

  // Create a new Map from the sorted entries
  return new Map(sortedEntries);
}
