import { RelativeStrength } from "../../services/relative-strength/relative-strength-types";

export interface RelativeStrengthsForSymbolResponse {
  symbol: string;
  relativeStrengths: RelativeStrength[];
  compositeScore: number;
}
