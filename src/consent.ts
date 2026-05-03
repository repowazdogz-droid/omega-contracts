import type { DataAvailability, DerivedFieldProvenance } from './shared.js';

export interface ConsentRecord {
  total_actions: number;
  violations: number;
  violations_by_severity: {
    critical: number;
    major: number;
    minor: number;
  };
  scope_creep_detected: boolean;
  scope_creep_pattern_count: number;
  authorisations_active: number;
  authorisations_expired: number;
  source_chain_verified: boolean;
  availability: Partial<Record<keyof ConsentRecord, DataAvailability>>;
  provenance?: DerivedFieldProvenance[];
}
