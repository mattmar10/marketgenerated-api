import * as z from "zod";

const s3CandleSchema = z.object({
  //"open": z.number(),
  //"high": z.number(),
  //"low": z.number(),
  //"close": z.number(),
  volume: z.number(),
  adjOpen: z.number(),
  adjHigh: z.number(),
  adjLow: z.number(),
  adjClose: z.number(),
  adjVolume: z.number(),
  dt: z.number(),
  extras: z.any(),
});

const tiingoCandleSchema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  adjOpen: z.number(),
  adjHigh: z.number(),
  adjLow: z.number(),
  adjClose: z.number(),
  adjVolume: z.number(),
  date: z.string(),
  extras: z.any(),
});

export function zodTiingoCandleSchema() {
  return tiingoCandleSchema;
}
export function zodTiingoCandlesSchema() {
  return tiingoCandleSchema.array();
}

export function zodS3CandleSchema() {
  return s3CandleSchema;
}

export function zodS3CandlesSchema() {
  return s3CandleSchema.array();
}
