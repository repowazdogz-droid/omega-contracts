# Changelog

All notable changes to `@omega-protocol/contracts`.

## 0.3.0

- Add optional top-level `generation` provenance block to the OmegaRecord
  envelope (`model_id`, `model_version`, optional `prompt_hash`, optional
  `tool_versions`) — P_VersionProvenance. Additive and backward-compatible:
  the block is **not** required, so existing records (including the locked
  composition test vector) remain schema-valid and **their content hashes are
  unaffected** (`ad7bfe01…` does not move). `schema_version` stays `omega/1.0`.
- `prompt_hash`, when present, is `sha256` (lowercase hex) over the RFC 8785
  (JCS) canonicalization of the prompt payload — i.e. `fingerprint()` from
  `src/encoding.ts` — so it is a verifiable commitment, not a free string.
- New `hasVersionProvenance(record)` predicate: a pure, re-runnable check of
  presence + well-formedness of the declared generator identifiers. It does
  NOT prove the declared model produced the record (that is actor-binding /
  attestation — the signature layer). `generation` is deliberately excluded
  from `gate_input_digest`; transplant of oversight approvals between records
  differing only in `generation` is blocked by G4 (record_id in the attestation
  message), not by G3.
- Lean mirror: new self-contained root `OmegaProvenance.lean` (zero user
  axioms).

Note: the embedded `contracts_version` pins in adapters/fixtures (e.g. the
composition vector, `SPECGAP_CONTRACTS_VERSION`) are intentionally left at
`0.2.2` in this change to keep existing record hashes stable; bumping those is
a separate, sibling-coordinated step.

## 0.2.2

- Prior baseline (composition test vector, P5 gate evaluator, SpecGap assurance
  adapter).
