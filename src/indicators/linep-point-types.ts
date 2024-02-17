export interface LinePoint {
  time: string;
  value: number;
}

export interface BetaLinePoint {
  time: string;
  beta: number;
  alpha: number;
  rsLineRatio: number;
  adustedRsLineRatio: number;
}
