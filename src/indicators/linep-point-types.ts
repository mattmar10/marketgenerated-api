export interface LinePoint {
  time: string;
  value: number;
}

export interface AVWapLinePoint {
  time: string;
  value: number;
  standardDeviation: number;
}

export interface AVWAPE {
  earningsDate: string;
  timeSeries: AVWapLinePoint[];
}

export interface BetaLinePoint {
  time: string;
  beta: number;
  alpha: number;
  rsLineRatio: number;
  adustedRsLineRatio: number;
}
