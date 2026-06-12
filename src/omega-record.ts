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
  /**
   * Generation provenance — the AI generator that produced this record
   * (P_VersionProvenance). OPTIONAL: a record without this block stays
   * schema-valid (pre-1.4.1 records carry none, and the locked composition
   * vector does not). The `hasVersionProvenance` predicate EVALUATES presence;
   * it is not schema-forced. Bound to `content_hash` like every other field,
   * so tampering with declared provenance already breaks the P3 chain.
   *
   * HONEST SCOPE: presence + well-formedness of declared generator identifiers
   * (and `prompt_hash` shape) only. It does NOT prove the declared model
   * actually produced this record, nor that `prompt_hash` commits the real
   * prompt — that is actor-binding / cryptographic attestation (the signature
   * layer), the same trust hole as the unsigned `actor_id`.
   *
   * Deliberately EXCLUDED from `gate_input_digest` (see gate-evaluator.ts):
   * `f` does not read `generation`, so it stays out of the "exactly what `f`
   * reads" evidence subset. This is NOT a transplant hole: two records identical
   * in subject+evidence but differing only in `generation` share a
   * gate_input_digest, yet an oversight approval cannot be transplanted between
   * them — that is blocked by G4 (the attestation message binds `record_id`),
   * not by G3 (the digest), and today additionally by G4 being fail-closed.
   */
  generation?: {
    model_id: string;
    model_version: string;
    /**
     * sha256 (lowercase hex) over the RFC 8785 (JCS) canonicalization of the
     * declared prompt payload — identical to `fingerprint()` in encoding.ts.
     * A verifier holding the prompt payload recomputes `fingerprint(payload)`
     * and compares. A commitment, not a free string.
     */
    prompt_hash?: string;
    tool_versions?: Record<string, string>;
  };
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
