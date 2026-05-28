# omega-contracts

## PURPOSE
`@omega-protocol/contracts` — the **canonical interoperability substrate** for
all OMEGA protocol libraries. Ships shared TypeScript types, JSON Schemas,
canonical encoding helpers, per-protocol fixtures, a composition test vector,
the adapter contract, and the conformance runner. **Not a runtime / router /
engine / decision-maker**: it validates governed evidence records, it does
**not** decide whether an action should proceed. Every trust-stack sibling
(clearpath, consent-ledger, assumption-registry, cognitive-ledger,
dispute-protocol, ethics-gate, harm-trace, trust-score, specgap) depends on this
package.

## STATUS
Live. Package version **`0.2.2`**. HEAD `b926b76` ("docs: add trust-stack
composition, primitive mapping, and assurance boundaries"). Published from
`dist/` (pre-built CommonJS-typed ESM). Locked composition test-vector hash:
`152eab926412e397dfdd56217dad03a924bc9c138bee2ceafa2f3200c3d2c705`.

## STACK
- TypeScript 5.9, `"type": "module"` (ESM).
- Runtime deps: `ajv ^8.20.0` (schema validation), `canonicalize ^3.0.0`
  (JCS canonical JSON).
- Dev: `vitest ^4.1.5`, `tsx ^4.21.0`, `json-schema-to-typescript ^15.0.4`,
  `@types/node ^25.6.0`.
- Build: `tsc && node scripts/postbuild.mjs` → `dist/`.
- Test: `vitest run`.

## ENTRY POINTS
- **Package name:** `@omega-protocol/contracts` (npm).
- **Version:** `0.2.2`.
- **Main:** `./dist/index.js`. **Types:** `./dist/index.d.ts`.
- **Exports map** (`package.json#exports`):
  - `.` → `./dist/index.js` (types `./dist/index.d.ts`)
  - `./schemas/*` → `./schemas/*` (raw JSON Schemas)
  - `./fixtures/*` → `./fixtures/*` (per-protocol fixtures)
  - `./package.json` → `./package.json`
- **CLI binaries** (`package.json#bin`):
  - `omega-contracts-conformance` → `dist/cli.js` (entry point for sibling
    repos to run conformance against their adapters).
  - `omega-contracts` → same binary, short alias.
- `src/index.ts` re-exports: `adapter, assurance, assumption, clearpath,
  cognitive, consent, dispute, encoding, ethics, harm, omega-record, shared,
  trust`.
- `src/cli.ts` — CLI: `omega-contracts-conformance <library-path> --level
  <C0|C1|C2|C3>`.
- `src/conformance.ts` — programmatic entry: `runConformance(...)`,
  `formatConformanceResult(...)`.
- `schemas/omega-record.schema.json` — top-level envelope.
- `schemas/{clearpath-summary, consent-record, ethics-review, harm-record,
  trust-score, trust-evidence, dimension-score, assumption-gate,
  assurance-result, specgap-assurance-summary, cognitive-profile,
  dispute-finding, data-availability, derived-field-provenance,
  protocol-id}.schema.json`.
- `fixtures/<protocol>/` — per-adapter canonical examples.
- `fixtures/composition/` — `inputs.json`, `expected_record.json`,
  `expected_content_hash.txt` (the locked test vector).
- Scripts (`package.json`): `build`, `test` (vitest), `check` (`tsc
  --noEmit`), `conformance` (`tsx src/cli.ts`).

## CONVENTIONS
- ESM-only — imports inside `src/` use `.js` extensions (e.g.
  `from './adapter.js'`) so the emitted `.js` resolves under Node ESM.
- One source file per protocol surface in `src/<protocol>.ts`; a matching
  `schemas/<protocol>-*.schema.json` is the cross-language source of truth.
- Conformance levels: **C0** schema, **C1** adapter (round-trip + determinism
  + fingerprint + availability), **C2** composition (no massaging into
  `OmegaRecord`), **C3** integrity (no adapter timestamps, derived-field
  provenance, content-hash reproducibility).
- Tests in `test/` (`conformance.test.ts`, `assurance-adapter.test.ts`,
  `fingerprint-vector.test.ts`). Vitest config at `vitest.config.ts`.
- **SpecGap assurance (shipped in-repo):** `src/assurance.ts` exports
  `specgapAssuranceAdapter` — native `{ ingress, envelope }` from
  `specgap.analyze_structured()` → canonical summarized `AssuranceResult`
  (`kind: specgap`, nested `specgap` summary + `provenance[]`). C0+C1 via
  `fixtures/specgap/`; **C2 blocked** until optional `OmegaRecord.assurance`
  slot is added (composition hash bump). Fingerprint: RFC 8785 JCS via
  `src/encoding.ts`, aligned with SpecGap `rfc8785` + shared
  `fixtures/specgap/fingerprint_vector.json`.
- `scripts/postbuild.mjs` runs after `tsc` to preserve the CLI shebang and
  executable bit (see commit `e184164`).

## DEPENDENCIES
- Internal: this is the **root** dep — no internal upstream. **All other
  trust-stack repos depend on this one** (consume types from
  `@omega-protocol/contracts`, schemas from
  `@omega-protocol/contracts/schemas/<file>`, fixtures from
  `@omega-protocol/contracts/fixtures/<protocol>/<file>`, and run
  `npx omega-contracts-conformance . --level C3` in CI).
- External: `ajv ^8.20.0`, `canonicalize ^3.0.0`. No framework deps.

## GOTCHAS
- This package is the **shared dep for the whole trust-stack batch**.
  Bumping `version` in `package.json` invalidates the
  `contracts_version` field embedded in every `OmegaRecord` produced by
  sibling adapters (current pin: `0.2.2`). Coordinate before bumping.
- ESM-only with `"type": "module"` — consumers using CJS need
  `await import()` or a bundler.
- `dist/` is checked in and shipped via `files: ["dist","schemas","fixtures"]`
  — do not delete it without re-running `npm run build`. The CLI shebang
  must survive `tsc` (handled by `scripts/postbuild.mjs`; see commit
  `e184164` for the historical fix).
- Test vector hash `152eab9264…c3d2c705` is **locked**. Any change to canonical
  encoding (`src/encoding.ts`), the omega-record schema, or composition
  inputs will change this hash — that is an intentional break and requires
  bumping the schema version (`omega/1.0`) plus coordinating sibling repos.
- `node_modules/` and `dist/` exist in the working tree — do not commit
  rebuilds without intent.
- Do not put runtime business logic here. This package validates;
  decisions live in protocol-specific adapters.

## LAST UPDATED
2026-05-28
