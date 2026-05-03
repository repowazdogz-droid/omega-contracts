import type { DataAvailability, DerivedFieldProvenance } from './shared.js';

export interface DisputeFinding {
  total_disputes: number;
  open_disputes: number;
  resolved_in_favor_of_actor: number;
  resolved_against_actor: number;
  precedents_set: number;
  divergence_summary: {
    different_evidence: number;
    different_assumptions: number;
    different_interpretation: number;
  };
  availability: Partial<Record<keyof DisputeFinding, DataAvailability>>;
  provenance?: DerivedFieldProvenance[];
}
