import type { AssumptionGate } from './assumption.js';
import type { ClearpathSummary } from './clearpath.js';
import type { CognitiveProfile } from './cognitive.js';
import type { ConsentRecord } from './consent.js';
import type { DisputeFinding } from './dispute.js';
import type { EthicsReview } from './ethics.js';
import type { HarmRecord } from './harm.js';
import type { DerivedFieldProvenance, ProtocolId } from './shared.js';
import type { TrustScore } from './trust.js';

export interface ReasoningNode {
  id: string;
  type: 'FACT' | 'INFERENCE' | 'ASSUMPTION' | 'UNKNOWN';
  statement: string;
}

export interface ReasoningChain {
  nodes: ReasoningNode[];
  edges: Array<{ from: string; to: string }>;
  acyclic: boolean;
  provenance?: DerivedFieldProvenance[];
}

export interface Expectation {
  predicted_outcome: string;
  committed_before_action: boolean;
  materiality_node?: string;
  provenance?: DerivedFieldProvenance[];
}

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
  reasoning?: ReasoningChain;
  expectation?: Expectation;
  outcome: {
    gate_result: 'COMMITTED' | 'HELD' | 'ESCALATED';
    gate_reason: string;
    acted: boolean;
    non_action_record?: string;
    blocked_by?: ProtocolId;
  };
  provenance?: DerivedFieldProvenance[];
  previous_hash: string | null;
  content_hash: string;
  signature?: string;
}
