# Assurance boundary — `@omega-protocol/contracts`

Verification is meaningful only **inside an explicit boundary**. This document states what this package guarantees, what it does not, what must be trusted (TCB), and how records can still mislead when the machinery works as designed.

---

## What this package guarantees

When used as documented (schema validation, canonical encoding, conformance runner):

| Guarantee | Mechanism |
| --- | --- |
| **Schema shape validation** | JSON Schemas in `schemas/` and TypeScript types in `src/` |
| **Canonical record structure** | Required fields on `OmegaRecord` per `omega-record.schema.json` |
| **Conformance fixture expectations** | C0–C3 checks in `src/conformance.ts` against published fixtures |
| **Hash input consistency** | If callers follow canonical JSON encoding (`src/encoding.ts`) and the same field selection rules as the composition fixture, `content_hash` is reproducible |

A record that passes schema validation and C3 self-test is **structurally conformant** to the published contract version.

---

## What this package does NOT guarantee

| Non-guarantee | Implication |
| --- | --- |
| **Truth of evidence** | Summaries may be wrong, incomplete, or fabricated while still schema-valid |
| **Correctness of reasoning** | `clearpath` faithfulness labels are claims, not verified cognition |
| **Legal compliance** | `consent` shapes are not GDPR, HIPAA, or contractual consent proof |
| **AI safety** | Record shape does not imply safe or aligned behavior |
| **Authorization validity in the real world** | `ConsentRecord` reflects recorded authorisations/actions, not legal authority |
| **Runtime enforcement** | No tool-call interception, blocking, or policy engine ships in this package |
| **Absence of tampering outside the recorded chain** | Tamper detection applies only where native libraries verify their own chains and integrators preserve linkage |

**This package validates governed evidence records; it does not decide whether an action should proceed.**

---

## Trusted computing base (TCB)

Components whose correctness is **assumed** when interpreting conformance results:

| TCB component | Role |
| --- | --- |
| **Schema definitions** | `schemas/*.schema.json` — what “valid” means |
| **Canonical JSON encoding** | RFC 8785-style canonicalization via `canonicalize` + package rules |
| **Hash implementation** | SHA-256 over canonical bytes as implemented in `src/encoding.ts` |
| **Caller-provided evidence** | Native protocol outputs, adapter implementations, and gate outcomes supplied by integrators |
| **CI / test runner** | Vitest suite and conformance CLI behavior in this repository |

**Outside the TCB:** sibling protocol libraries, SpecGap abstract models, Lean proofs, deployment environments, and any private gate runtime.

---

## Failure modes (valid records, wrong world)

Even when schemas pass and hashes reproduce:

| Failure mode | Description |
| --- | --- |
| **Valid false record** | Well-formed record whose summaries do not match reality |
| **Stale evidence** | Old traces or scores embedded with current `created_at` |
| **Forged authority source** | Authorisations recorded without genuine principal intent |
| **Omitted decision** | Consequential action taken with no record emitted |
| **Semantic mismatch** | Field names match schema but misrepresent the underlying event |
| **Hash-chain poisoned anchor** | Chain integrity holds from a false genesis record forward |
| **Gate encoding without gate** | `outcome.gate_result: COMMITTED` set without an actual threshold evaluation |
| **Derived field without provenance** | Summaries present without `provenance[]` when C3 provenance is claimed |
| **Assurance confusion** | SpecGap PASS treated as runtime security (SpecGap is pre-runtime abstract evidence only) |

---

## Conformance levels and limits

| Level | Proves | Does not prove |
| --- | --- | --- |
| C0 | Type/schema alignment | Runtime behavior |
| C1 | Adapter determinism on fixtures | Correctness of native library logic |
| C2 | Composition into `OmegaRecord` | End-to-end system governance |
| C3 | Provenance and hash reproducibility on fixtures | Production data integrity |

Locked composition test vector hash (see README): reproducibility anchor for the **fixture**, not for live deployments.

---

## Related work (outside this package)

| Tool | Boundary |
| --- | --- |
| [specgap](https://github.com/repowazdogz-droid/specgap) | Pre-runtime spec divergence in an abstract model |
| [clearpath](https://github.com/repowazdogz-droid/clearpath) | Native decision trace hash chains |
| [omega-lean-proof](https://github.com/repowazdogz-droid/omega-lean-proof) | Formal predicate definitions |

---

## Related docs

- [TRUST_STACK.md](./TRUST_STACK.md)
- [PRIMITIVE_MAP.md](./PRIMITIVE_MAP.md)
