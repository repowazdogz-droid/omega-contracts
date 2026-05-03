import type { DataAvailability, DerivedFieldProvenance } from './shared.js';

export interface HarmRecord {
  total_incidents: number;
  max_severity: number | null;
  max_severity_label:
    | 'negligible'
    | 'minor'
    | 'moderate'
    | 'severe'
    | 'critical'
    | 'catastrophic'
    | null;
  severity_distribution: Record<string, number>;
  remediation_rate: number | null;
  pending_remediations: number;
  consequence_chain_count: number;
  availability: Partial<Record<keyof HarmRecord, DataAvailability>>;
  provenance?: DerivedFieldProvenance[];
}
