import { VolatilityData as VolatilityData } from "../../services/levels/levels-types";

export interface DailyReturn {
  dt: number;
  dateString: string;
  returnPercent: number;
}

export interface DailyReturns {
  symbol: string;
  returns: DailyReturn[];
}
