import { inject, injectable } from "inversify";
import {
  MajorStockIndex,
  StockIndexConstituentList,
  StockIndexConstituentListSchema,
} from "./stock-index-types";
import axios from "axios";
import {
  FMPHistoricalArraySchema,
  FmpHistoricalListResultSchema,
} from "../financial_modeling_prep_types";

type StockIndexServiceError = string;

@injectable()
export class StockIndexService {
  private FINANCIAL_MODELING_PREP_URL =
    "https://financialmodelingprep.com/api/v3";
  private financialModelingPrepKey = process.env.FINANCIAL_MODELING_PREP_KEY;

  constructor() {}

  public async getConstituents(
    index: MajorStockIndex
  ): Promise<StockIndexConstituentList | StockIndexServiceError> {
    let indexPart = "";

    if (index == "DOW") {
      indexPart = "dowjones_constituent";
    } else if (index == "NS100") {
      indexPart = "nasdaq_constituent";
    } else {
      indexPart = "sp500_constituent";
    }

    const url = `${this.FINANCIAL_MODELING_PREP_URL}/${indexPart}?apikey=${this.financialModelingPrepKey}`;

    try {
      const response = await axios.get(url);
      const data = response.data;
      const parsed = StockIndexConstituentListSchema.safeParse(data);

      if (!parsed.success) {
        return "Unable to parse index constituents";
      } else {
        return parsed.data;
      }
    } catch (error) {
      const dataError: StockIndexServiceError = `Unable to fetch constituents for ${index}`;
      return dataError;
    }
  }

  public async getHistoricalIndexData() {
    const urlPart = `/historical-price-full/%5EGSPC,%5EDJI,%5EIXIC?apikey=${this.financialModelingPrepKey}`;

    const url = `${this.FINANCIAL_MODELING_PREP_URL}/${urlPart}`;
    try {
      console.log(`fetching historical index data from FMP`);
      const response = await axios.get(url);
      const data = response.data;
      const parsed = FmpHistoricalListResultSchema.safeParse(data);

      if (!parsed.success) {
        return "Unable to parse index constituents";
      } else {
        return parsed.data;
      }
    } catch (error) {
      const dataError: StockIndexServiceError = `Historical index data `;
      return dataError;
    }
  }
}
