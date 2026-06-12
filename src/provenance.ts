import { fingerprint } from './encoding.js';
import type { OmegaRecord } from './omega-record.js';

/**
 * P_VersionProvenance — generation provenance (model / prompt / tool binding).
 *
 * HONEST SCOPE (PRIMITIVE_MAP register): `hasVersionProvenance` proves only the
 * PRESENCE and WELL-FORMEDNESS of declared generator identifiers — a
 * `generation` block exists, `model_id` and `model_version` are non-empty, and
 * `prompt_hash` (if present) is a syntactically valid sha256 commitment. It does
 * NOT prove the declared model actually produced this record, NOT that the
 * `prompt_hash` commits the real prompt (no preimage is checked unless the
 * prompt payload is supplied to `verifyPromptHash`), and NOT that the declared
 * identifiers name a real or honest model. Binding the declared generator to the
 * actual generation event is actor-binding / cryptographic attestation (the
 * signature layer, build step 3) — the same trust hole as the unsigned
 * `actor_id`. This is presence + shape only.
 *
 * DIGEST EXCLUSION IS NOT A TRANSPLANT HOLE. `generation` is deliberately kept
 * out of `gate_input_digest` (see gate-evaluator.ts) because the gate `f` does
 * not read it, so it stays outside the "exactly what `f` reads" evidence subset.
 * Consequence: two records identical in subject+evidence but differing ONLY in
 * `generation` share a `gate_input_digest`. An oversight approval still cannot be
 * transplanted between them — that is blocked by G4 (the cryptographic
 * attestation message binds this record's `record_id`), NOT by G3 (the digest),
 * and today additionally by G4 being fail-closed. `generation` is, however,
 * bound to `content_hash` like every other field, so tampering with declared
 * provenance already breaks the P3 hash chain.
 */

/** sha256 lowercase-hex shape — the only well-formedness `f` checks for prompt_hash. */
export const PROMPT_HASH_PATTERN = /^[a-f0-9]{64}$/;

/**
 * The deterministic P_VersionProvenance predicate. Pure and total: a verifier
 * can re-run it over any record and get the same Bool. Returns true iff a
 * well-formed `generation` block is present.
 */
export function hasVersionProvenance(record: OmegaRecord): boolean {
  const g = record.generation;
  if (g === undefined) {
    return false;
  }
  if (typeof g.model_id !== 'string' || g.model_id.length === 0) {
    return false;
  }
  if (typeof g.model_version !== 'string' || g.model_version.length === 0) {
    return false;
  }
  if (g.prompt_hash !== undefined && !PROMPT_HASH_PATTERN.test(g.prompt_hash)) {
    return false;
  }
  return true;
}

/**
 * Verify a recorded `prompt_hash` against a supplied prompt payload. This is the
 * preimage check the presence predicate cannot do on its own: `prompt_hash` is
 * defined as sha256 over the RFC 8785 (JCS) canonicalization of the prompt
 * payload, i.e. exactly `fingerprint(promptPayload)`. Returns false if no
 * `prompt_hash` is recorded. Holding the payload, an external party calls this
 * to confirm the commitment — making `prompt_hash` verifiable, not a free string.
 *
 * Still does NOT prove the payload is the prompt the model actually consumed;
 * it proves the recorded commitment matches the payload you hold.
 */
export function verifyPromptHash(record: OmegaRecord, promptPayload: unknown): boolean {
  const recorded = record.generation?.prompt_hash;
  if (recorded === undefined) {
    return false;
  }
  return fingerprint(promptPayload) === recorded;
}
