import { inject, injectable } from "inversify";
import { Client } from "pg";
import { PredefinedScanInfo } from "./scan-models";
import TYPES from "../../types";

@injectable()
export class ScanRepository {
  constructor(@inject(TYPES.PGClient) private readonly client: Client) {}

  public async getScans(): Promise<PredefinedScanInfo[]> {
    try {
      const query = "SELECT * FROM mg.scans";
      const result = await this.client.query(query);

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
    }
  }
}
