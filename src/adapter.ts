import type { CanonicalShapeName, ProtocolId } from './shared.js';

export interface ProtocolAdapter<NativeRecord, CanonicalShape> {
  protocolId: ProtocolId;
  protocolVersion: string;
  contractsVersion: string;
  canonicalShape: CanonicalShapeName;

  /**
   * Converts native protocol records into the canonical shape.
   *
   * Implementations MUST be deterministic: byte-identical inputs must produce
   * byte-identical canonical outputs. Implementations MUST NOT generate
   * timestamps, random IDs, locale-dependent ordering, or other nondeterminism.
   */
  toCanonical(records: NativeRecord[]): CanonicalShape;

  /**
   * Validates canonical output against the published contract shape/schema.
   * Validation must not mutate the supplied canonical shape.
   */
  validate(shape: CanonicalShape): { ok: true } | { ok: false; errors: string[] };

  /**
   * Returns a reproducibility anchor for native input records.
   *
   * Implementations MUST return SHA-256 over RFC 8785 canonicalized input and
   * MUST return the same fingerprint for byte-identical inputs.
   */
  fingerprint(records: NativeRecord[]): string;
}
