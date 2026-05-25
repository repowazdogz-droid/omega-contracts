# Trust stack map

`@omega-protocol/contracts` is the **canonical evidence envelope** for the public OMEGA Lab stack. It defines shared record shapes, JSON Schemas, canonical encoding, fixtures, and a conformance runner.

It is **not** a runtime, router, gate engine, or enforcement service. It does not execute tool calls, block actions, or validate real-world facts.

Sibling repositories produce native protocol artifacts. This package defines how those artifacts **compose into** an `OmegaRecord` when integrators follow the adapter contract.

---

## Lab layers → repositories → record slots

| Repository | Lab layer | Native role | Maps into `OmegaRecord` |
| --- | --- | --- | --- |
| [specgap](https://github.com/repowazdogz-droid/specgap) | **Assurance** | Pre-runtime spec divergence evidence (abstract model, Z3, triangulation) | `provenance[]` (derived-field lineage), optional external evidence referenced by integrators — **not a first-class slot today** |
| [omega-lean-proof](https://github.com/repowazdogz-droid/omega-lean-proof) | **Doctrine** | Formal predicate names (`Governed`, P1–P12 family, hash-chain lemmas) | **Conceptual only** — no Lean export is embedded in records; see [PRIMITIVE_MAP.md](./PRIMITIVE_MAP.md) |
| [clearpath](https://github.com/repowazdogz-droid/clearpath) | **Replay** | Hash-chained decision trace summaries | `clearpath` → `ClearpathSummary` |
| [consent-ledger](https://github.com/repowazdogz-droid/consent-ledger) | **Authority** | Authorisation vs action boundary | `consent` → `ConsentRecord` |
| [assumption-registry](https://github.com/repowazdogz-droid/assumption-registry) | **Materiality** | Load-bearing assumptions and pre-action gate **reports** | `assumption` → `AssumptionGate` |
| [harm-trace](https://github.com/repowazdogz-droid/harm-trace) | **Consequence replay** | Post-hoc consequence chains | `harm` → `HarmRecord` |
| [dispute-protocol](https://github.com/repowazdogz-droid/dispute-protocol) | **Disagreement** | Trace divergence and dissent preservation | `dispute` → `DisputeFinding` |
| [trust-score](https://github.com/repowazdogz-droid/trust-score) | **Derived verifier aid** | Aggregated score summaries for policy checks | `trust` → `TrustScore` — **derived signal only, never ground truth** |

Every governed record also carries:

| Field | Role |
| --- | --- |
| `subject` | Domain, action, `actor_id`, stakes |
| `outcome` | Gate **encoding** (`COMMITTED` / `HELD` / `ESCALATED`) — see [PRIMITIVE_MAP.md](./PRIMITIVE_MAP.md) for implementation status |
| `previous_hash`, `content_hash` | Hash-chain linkage between records |
| `provenance` | Optional derived-field lineage for summarized slots |

---

## Composition model

```
Native protocol library  →  ProtocolAdapter.toCanonical()  →  canonical shape
                                                              ↓
                                                    OmegaRecord slot(s)
                                                              ↓
                                              schema validation + encoding + content_hash
```

**Shipped today in this package:** adapter **interface**, fixtures, and conformance runner.

**Shipped today in sibling repos:** live `ProtocolAdapter` implementations in [clearpath](https://github.com/repowazdogz-droid/clearpath), [consent-ledger](https://github.com/repowazdogz-droid/consent-ledger), and [assumption-registry](https://github.com/repowazdogz-droid/assumption-registry) (`src/adapter.ts` + fixture conformance tests).

**Not shipped:** harm-trace, dispute-protocol, trust-score, ethics-gate, cognitive-ledger. End-to-end composition is still verified primarily against fixtures under `fixtures/composition/` until live adapters cover all slots.

---

## Terminology (public stack)

| Term | Meaning in this stack |
| --- | --- |
| **Replay** | Re-export / re-verify recorded structure, not re-prove world truth |
| **Verification** | Chain, schema, or conformance check unless explicitly tied to an external verification workflow |
| **HELD / HOLD** | Record encoding or operator-review recommendation — not an autonomous stop |
| **Faithfulness** | Annotated label on trace nodes, not verified cognition |
| **Governance** | Record shape and integrator claims, not organizational approval |

---

## Conformance levels (summary)

| Level | What it checks |
| --- | --- |
| C0 | Types and schemas align with this package |
| C1 | Adapter determinism, fingerprint stability, canonical round-trip |
| C2 | Adapter output integrates into `OmegaRecord` without massaging |
| C3 | Derived-field provenance, no adapter timestamps, content hash reproducibility |

Run: `npx omega-contracts-conformance <library-path> --level C3`

---

## Core claim (bounded)

**A valid `OmegaRecord` proves record conformance** — shape, required fields, and (when correctly computed) hash linkage under the published encoding rules.

It does **not** prove real-world correctness, faithful reasoning, valid authorisation, or that an action should have proceeded.

See [ASSURANCE_BOUNDARY.md](./ASSURANCE_BOUNDARY.md) and [PRIMITIVE_MAP.md](./PRIMITIVE_MAP.md).

---

## Related

- [PRIMITIVE_MAP.md](./PRIMITIVE_MAP.md) — primitive → field → implementation status
- [ASSURANCE_BOUNDARY.md](./ASSURANCE_BOUNDARY.md) — guarantees, non-guarantees, TCB, failure modes
- [omegaprotocol.org](https://omegaprotocol.org) — lab site
- [Profile README](https://github.com/repowazdogz-droid/repowazdogz-droid) — start here
