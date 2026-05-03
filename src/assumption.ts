import type { DataAvailability, DerivedFieldProvenance } from './shared.js';

export interface AssumptionGate {
  total_assumptions: number;
  load_bearing_count: number;
  load_bearing_validated: number;
  validation_ratio: number | null;
  expired_assumptions: number;
  cascade_risks: number;
  pre_action_gate: 'pass' | 'caution' | 'block';
  pre_action_reasons: string[];
  availability: Partial<Record<keyof AssumptionGate, DataAvailability>>;
  provenance?: DerivedFieldProvenance[];
}
