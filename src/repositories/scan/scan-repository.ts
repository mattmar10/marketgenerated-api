import { inject, injectable } from "inversify";
import { Client, Pool } from "pg";
import { PredefinedScanInfo, ScanResult } from "./scan-models";
import TYPES from "../../types";
import { Ticker } from "../../MarketGeneratedTypes";

@injectable()
export class ScanRepository {
  constructor(@inject(TYPES.PGPool) private readonly pool: Pool) {}

  public async getScans(): Promise<PredefinedScanInfo[]> {
    const client = await this.pool.connect();

    try {
      const query = "SELECT * FROM mg.scans";
      const result = await client.query(query);

      const scanInfos: PredefinedScanInfo[] = [];
      const rows = result.rows;

      for (const row of rows) {
        const name = row.name;
        const s3Identifier = row.s3identifier;
        const description = row.description;
        const active = row.active;
        const advanced = row.advanced;

        if (active) {
          scanInfos.push({
            name,
            description,
            s3Identifier,
            advanced,
            active,
          });
        }
      }
      return scanInfos;
    } catch (error) {
      console.error("Error executing query:", error);
      return [];
    } finally {
      client.release(); // Release the client back to the pool
    }
  }

  public async getScanResultsForTicker(ticker: Ticker): Promise<ScanResult[]> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT s.name AS scanName, ssr.date AS date, ssr.scan_id AS scanId
        FROM mg.scans s
        JOIN mg.stock_scan_results ssr ON s.id = ssr.scan_id
        WHERE ssr.ticker = $1
      `;
      const values = [ticker];

      const stockResult = await client.query(query, values);

      // Map the database results to the ScanResult interface
      const scanResults: ScanResult[] = stockResult.rows.map((row) => ({
        ticker: ticker,
        date: row.date,
        scanName: row.scanname,
        scanId: row.scanid,
      }));

      const etfQuery = `
        SELECT s.name AS scanName, ssr.date AS date, ssr.scan_id AS scanId
        FROM mg.scans s
        JOIN mg.etf_scan_results ssr ON s.id = ssr.scan_id
        WHERE ssr.ticker = $1
      `;

      const etfResult = await client.query(etfQuery, values);

      // Map the database results to the ScanResult interface
      const etfscanResults: ScanResult[] = etfResult.rows.map((row) => ({
        ticker: ticker,
        date: row.date,
        scanName: row.scanname,
        scanId: row.scanid,
      }));

      return scanResults.concat(etfscanResults);
    } finally {
      // Release the client back to the pool
      client.release();
    }
  }
}
