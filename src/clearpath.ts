import type { DataAvailability, DerivedFieldProvenance } from './shared.js';

export interface ClearpathSummary {
  total_traces: number;
  verification_failures: number;
  assumption_ratio: number | null;
  alternatives_considered_avg: number | null;
  faithfulness_distribution: {
    verified_faithful: number;
    narrative: number;
    unverified: number;
    disputed: number;
  };
  availability: Partial<Record<keyof ClearpathSummary, DataAvailability>>;
  provenance?: DerivedFieldProvenance[];
}
