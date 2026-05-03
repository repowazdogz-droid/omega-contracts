import type { DataAvailability, DerivedFieldProvenance } from './shared.js';

export interface EthicsReview {
  total_reviews: number;
  outcome_distribution: {
    pass: number;
    flag_minor: number;
    flag_major: number;
    flag_critical: number;
    requires_human_review: number;
  };
  unacknowledged_flags: number;
  vulnerable_population_concerns: number;
  weaponisation_concerns: number;
  availability: Partial<Record<keyof EthicsReview, DataAvailability>>;
  provenance?: DerivedFieldProvenance[];
}
