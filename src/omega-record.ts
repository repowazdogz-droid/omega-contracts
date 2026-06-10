import type { AssumptionGate } from './assumption.js';
import type { ClearpathSummary } from './clearpath.js';
import type { CognitiveProfile } from './cognitive.js';
import type { ConsentRecord } from './consent.js';
import type { DisputeFinding } from './dispute.js';
import type { EthicsReview } from './ethics.js';
import type { HarmRecord } from './harm.js';
import type { DerivedFieldProvenance, ProtocolId } from './shared.js';
import type { TrustScore } from './trust.js';

export interface OmegaRecord {
  record_id: string;
  schema_version: 'omega/1.0';
  contracts_version: string;
  created_at: string;
  subject: {
    domain: string;
    action: string;
    actor_id: string;
    stakes: 'low' | 'moderate' | 'high' | 'critical';
  };
  clearpath?: ClearpathSummary;
  cognitive?: CognitiveProfile;
  consent?: ConsentRecord;
  harm?: HarmRecord;
  assumption?: AssumptionGate;
  dispute?: DisputeFinding;
  ethics?: EthicsReview;
  trust?: TrustScore;
  outcome: {
    gate_result: 'COMMITTED' | 'HELD' | 'ESCALATED';
    gate_reason: string;
    acted: boolean;
    non_action_record?: string;
    blocked_by?: ProtocolId;
    /**
     * Human-oversight disposition. Audit-bound, NOT a self-certifying bypass:
     * `f` (see gate-evaluator.ts) clears an escalation only when the disposition
     * is `approved` AND guards G1 (separation: approver_id ≠ actor_id),
     * G2 (scoping: trigger ∈ cleared_triggers), G3 (anti-transplant:
     * gate_input_digest matches the record's recomputed evidence digest) and
     * G4 (cryptographic attestation) all hold. G4 is fail-closed until the
     * signature layer (build step 3) ships. There is deliberately no
     * `obtained`/`required` boolean — presence of an attested `approved`
     * disposition is the only thing that clears, and only for clearable
     * triggers {R1, R2, R6, R7}; hard blocks {R3, R4, R5} are never clearable.
     */
    human_oversight?: {
      disposition: 'approved' | 'rejected';
      approver_id: string;
      cleared_triggers: string[];
      gate_input_digest: string;
      oversight_record_ref: string;
      attestation: string;
    };
  };
  provenance?: DerivedFieldProvenance[];
  previous_hash: string | null;
  content_hash: string;
  signature?: string;
}
