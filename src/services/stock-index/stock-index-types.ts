import * as z from "zod";

export type MajorStockIndex = "SP500" | "DOW" | "NS100";

export const StockIndexConstituentSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  sector: z.string(),
  subSector: z.string(),
});

export type StockIndexConstituent = z.infer<typeof StockIndexConstituentSchema>;

export const StockIndexConstituentListSchema =
  StockIndexConstituentSchema.array();

export type StockIndexConstituentList = z.infer<
  typeof StockIndexConstituentListSchema
>;

export function isStockIndexConstituentList(
  obj: any
): obj is StockIndexConstituentList {
  if (!Array.isArray(obj)) {
    return false;
  }

  return obj.every(
    (item) =>
      typeof item.symbol === "string" &&
      typeof item.name === "string" &&
      typeof item.sector === "string" &&
      typeof item.subSector === "string"
  );
}
