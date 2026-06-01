export type ProtocolId =
  | 'clearpath'
  | 'cognitive-ledger'
  | 'consent-ledger'
  | 'harm-trace'
  | 'assumption-registry'
  | 'dispute-protocol'
  | 'ethics-gate'
  | 'trust-score'
  | 'omega-record';

export type CanonicalShapeName =
  | 'ClearpathSummary'
  | 'CognitiveProfile'
  | 'ConsentRecord'
  | 'HarmRecord'
  | 'AssumptionGate'
  | 'DisputeFinding'
  | 'EthicsReview'
  | 'TrustScore'
  | 'OmegaRecord';

export type DataAvailability =
  | 'available'
  | 'not_collected'
  | 'not_applicable'
  | 'withheld'
  | 'insufficient_history';

export interface DerivedFieldProvenance {
  field: string;
  method: string;
  inputs: string[];
  confidence: number;
  input_fingerprint: string;
}
