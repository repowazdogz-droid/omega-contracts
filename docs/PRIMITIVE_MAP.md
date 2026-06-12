# Primitive map

This document maps **named OMEGA primitives** (as used in doctrine and the public stack) to **`OmegaRecord` fields** and **honest implementation status** in public repositories as of contracts `0.2.2`.

**Legend — implementation status**

| Status | Meaning |
| --- | --- |
| **schema-only** | Field or enum exists in TypeScript types / JSON Schema only |
| **fixture-only** | Exercised in `fixtures/` and conformance self-tests, not produced by a shipped sibling adapter |
| **implemented in sibling repo** | Native library implements behavior; may not yet export a contracts adapter |
| **not implemented** | No public library behavior tied to this primitive |

**Doctrine note:** [omega-lean-proof](https://github.com/repowazdogz-droid/omega-lean-proof) proves **logical properties of named predicates** in Lean 4. That is not runtime enforcement and does not automatically populate records.

---

## Primitive reference table

| Primitive | Intended meaning | Contracts field(s) | Public implementation status | Assurance boundary |
| --- | --- | --- | --- | --- |
| **P1 Governance / authority** | Decision is bound to a goal contract reference and acting agent identity | `subject.actor_id`; governance metadata expected in wrapper config / provenance (not a dedicated P1 slot); Lean `P1_Governance` models contract + agent presence | **schema-only** for full P1 binding; **implemented in sibling repo** for agent identity in traces (`clearpath`, `consent-ledger` authorisations) | Record names an actor; does not prove the actor was authorised or competent |
| **P3 Traceability / hash chain** | Records are append-only and hash-linked; tamper breaks the chain | `previous_hash`, `content_hash`; slot-level `*.provenance[]`; `clearpath.verification_failures` | **schema-only** at record level; **implemented in sibling repo** (`clearpath` trace verify); Lean `OmegaP3Semantic` models chain (with crypto axiom) | Hash match verifies encoding linkage, not that upstream native traces were honest |
| **P4 Expectation** | Stakeholder expectations are explicit and checkable | No dedicated P4 slot; related signals in `clearpath` (alternatives, faithfulness) and assurance outputs | **not implemented** as P4; partial analogues in **implemented in sibling repo** (`clearpath`) and **Assurance** (`specgap`) | Expectation satisfaction is not proven by record shape alone |
| **P4M Materiality** | Load-bearing assumptions and stakes-aware materiality are surfaced before action | `subject.stakes`; `assumption` → `AssumptionGate` (`load_bearing_count`, `pre_action_gate`, …) | **implemented in sibling repo** (`assumption-registry` adapter shipped); `pre_action_gate` is a **report label**, not an enforced block in this package | `pre_action_gate: block` in a summary does not stop execution without an external gate |
| **P5 Confirmation / gate state** | Materiality threshold met → `COMMITTED`; not met → `HELD`; escalation path → `ESCALATED` | `outcome.gate_result`, `outcome.gate_reason`, `outcome.acted`, `outcome.non_action_record`, `outcome.blocked_by` | **evaluator published** (`src/gate-evaluator.ts`; Lean mirror `OmegaP5Gate.lean`) — `gate_result` is **externally re-checkable** as a deterministic function of recorded evidence; **not enforced at record-emission time** | A record may still be emitted with a `gate_result` the evaluator would reject — the evaluator **detects** the mismatch, it does not **prevent** emission |
| **P5E Execution attestation** | Acted vs not-acted is recorded with reason | `outcome.acted`, `outcome.gate_reason`, `outcome.non_action_record` | **schema-only** | Self-reported execution status unless bound to external telemetry |
| **P6 Delegation** | Agent actions stay within human-granted scope | `consent` → `ConsentRecord` (violations, scope creep flags, chain verified) | **implemented in sibling repo** (`consent-ledger` adapter shipped) | Matcher results are structural over recorded authorisations/actions, not legal delegation proof |
| **P10 Competence attestation** | Competence evidence attached where available | `trust` → `TrustScore`; optional `cognitive` → `CognitiveProfile` (not trunk-promoted) | **fixture-only** for composition; **implemented in sibling repo** (`trust-score`, `cognitive-ledger`) as derived summaries | Scores and profiles are **evidence summaries**, not certifications |
| **P11 Expectation update integrity** | Expectation updates are recorded when beliefs change | No dedicated slot | **not implemented** in public stack | — |
| **P12 Semantic integrity validation** | Semantic drift across layers is detected | No dedicated slot; closest public tool: **Assurance** (`specgap`) | **implemented in sibling repo** (`specgap`, pre-runtime); **not implemented** inside `OmegaRecord` pipeline | SpecGap checks abstract spec layers, not live record semantics |
| **P_VersionProvenance** (generation provenance) | The model/prompt that produced the record is declared and externally checkable | `generation` → `{ model_id, model_version, prompt_hash?, tool_versions? }` | **predicate published + kernel-verified** (`src/provenance.ts` `hasVersionProvenance`; Lean mirror `OmegaProvenance.lean`, zero user axioms) — presence + well-formed `prompt_hash` commitment only; optional block, absence detectable | Does NOT prove the declared model produced the record nor that `prompt_hash` commits the real prompt (actor-binding / signature layer); excluded from `gate_input_digest`, bound to `content_hash` |

---

## P5 explicit status (read this first)

Public repositories today provide:

1. **Types and JSON Schema** for `outcome.gate_result` ∈ `COMMITTED` | `HELD` | `ESCALATED`
2. **Fixtures** showing example gate outcomes in a composed record
3. **A published gate evaluator** (`src/gate-evaluator.ts`): the deterministic R1–R22 function `f` over recorded evidence, with a Lean mirror (`OmegaP5Gate.lean`) carrying kernel-verified no-false-COMMIT, hard-block, and fail-closed theorems with no user axioms. A verifier can recompute `f(record)` and confirm it equals the recorded `gate_result`.

What `f` does **not** do: it is **not enforced at record-emission time**. A record may be written with any `gate_result` — including one `f` would reject — by manual entry or private runtime code. `f` lets a verifier **detect** such a mismatch after the fact; it does not **prevent** the record from being emitted. `f` also does not prove the recorded inputs were true, that this policy is the mandated policy, or that a demanded human escalation actually occurred. Oversight-clearing of clearable escalations is **fail-closed** (guard G4) pending the signature/attestation layer, so `ESCALATED` is in effect still absorbing today.

A record with `gate_result: 'COMMITTED'` is **schema-valid** even when `f` would return `HELD` or `ESCALATED`; the published evaluator is what makes that discrepancy externally checkable.

---

## Slot → sibling repo → adapter status

| `OmegaRecord` slot | Sibling repo | Adapter in sibling repo |
| --- | --- | --- |
| `clearpath` | clearpath | **shipped** (`src/adapter.ts` + fixture conformance tests) |
| `consent` | consent-ledger | **shipped** (`src/adapter.ts` + fixture conformance tests) |
| `assumption` | assumption-registry | **shipped** (`src/adapter.ts` + fixture conformance tests) |
| `harm` | harm-trace | **not shipped** |
| `dispute` | dispute-protocol | **not shipped** |
| `trust` | trust-score | **not shipped** |
| `cognitive` | cognitive-ledger | **not shipped** (non-trunk) |
| `ethics` | ethics-gate | **not shipped** (non-trunk) |
| `generation` | — | **caller-supplied** — no sibling adapter populates it; the `hasVersionProvenance` predicate checks presence/well-formedness only |

Conformance interface: `ProtocolAdapter` in `src/adapter.ts`.

---

## Lean ↔ contracts ↔ runtime gap

| Layer | What it proves or defines |
| --- | --- |
| **Lean** (`omega-lean-proof`) | Named `Prop` predicates and sufficiency/necessity lemmas over those definitions |
| **Contracts** (this package) | Record shapes and composition rules |
| **Sibling libraries** | Native hash chains, summaries, and reports |
| **Runtime gate** | **Evaluator public** (`src/gate-evaluator.ts`, Lean-mirrored) — re-checkable `f` over recorded evidence; **emission-time enforcement / attested oversight clearing still pending** (G4 fail-closed) |

See [omega-lean-proof docs/OPERATIONAL_GAP.md](https://github.com/repowazdogz-droid/omega-lean-proof) when published; until then, treat Lean as **doctrine**, not deployment attestation.

---

## Related

- [TRUST_STACK.md](./TRUST_STACK.md)
- [ASSURANCE_BOUNDARY.md](./ASSURANCE_BOUNDARY.md)
