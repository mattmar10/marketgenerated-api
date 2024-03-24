import { z } from "zod";

// Define the Zod schema for VolumeSurgeCandidate
export const VolumeSurgeCandidateSchema = z.object({
  ticker: z.string(),
  lastPrice: z.number(),
  dayIBS: z.number(),
  vwap: z.optional(z.number()),
  twentyOneEMA: z.optional(z.number()),
});

// Type alias for VolumeSurgeCandidate
export type VolumeSurgeCandidate = z.infer<typeof VolumeSurgeCandidateSchema>;
