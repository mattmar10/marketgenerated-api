export interface VolatilityData {
  period: number;
  standardDeviation: number;
  avgRange: number;
  mean?: number;
}

export interface CandleWithVolatilityData {
  date: string;
  volatilityData: VolatilityData;
}
