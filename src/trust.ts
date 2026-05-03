import type { DataAvailability, DerivedFieldProvenance } from './shared.js';

export type EvidenceSourceType =
  | 'clearpath_trace'
  | 'cognitive_ledger'
  | 'consent_ledger'
  | 'harm_trace'
  | 'assumption_registry'
  | 'dispute_record'
  | 'ethics_review'
  | 'external_attestation';

export interface TrustEvidence {
  source_type: EvidenceSourceType;
  source_id: string;
  weight: number;
  recorded_at: string;
  reference_record_id?: string;
}

export interface DimensionScore {
  raw_score: number | null;
  score: number | null;
  confidence: number;
  evidence_count: number;
  last_updated: string;
  availability: DataAvailability;
}

export interface TrustScore {
  actor_id: string;
  computed_at: string;
  overall_score: number | null;
  overall_availability: DataAvailability;
  dimensions: {
    transparency: DimensionScore;
    calibration: DimensionScore;
    consistency: DimensionScore;
    consent_compliance: DimensionScore;
    harm_record: DimensionScore;
    assumption_discipline: DimensionScore;
    dispute_record: DimensionScore;
    ethics_record: DimensionScore;
  };
  evidence_sources: TrustEvidence[];
  decay_applied: boolean;
  provenance?: DerivedFieldProvenance[];
}
