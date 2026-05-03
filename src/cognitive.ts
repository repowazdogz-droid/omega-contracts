import type { DataAvailability, DerivedFieldProvenance } from './shared.js';

export interface CognitiveProfile {
  calibration: number | null;
  bias_count: number;
  growth_trajectory: 'improving' | 'stable' | 'declining' | 'unknown';
  /**
   * Proportion of decisions in the same domain whose reasoning-pattern n-grams
   * have cosine similarity >= 0.7 to the actor's median pattern.
   */
  consistency: number | null;
  recurring_biases: Array<{
    bias_type: string;
    frequency: number;
    confidence: number;
  }>;
  availability: Partial<Record<keyof CognitiveProfile, DataAvailability>>;
  provenance?: DerivedFieldProvenance[];
}
