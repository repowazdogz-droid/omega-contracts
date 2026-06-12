import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeContentHash, fingerprint } from '../src/encoding.js';
import { computeGateInputDigest } from '../src/gate-evaluator.js';
import type { OmegaRecord } from '../src/omega-record.js';
import { hasVersionProvenance, verifyPromptHash } from '../src/provenance.js';

const require = createRequire(import.meta.url);
const Ajv = require('ajv') as new (o?: Record<string, unknown>) => {
  addSchema(s: unknown): void;
  getSchema(id: string): ((d: unknown) => boolean) | undefined;
};

const schemasDir = new URL('../schemas/', import.meta.url).pathname;
const LOCKED_COMPOSITION_HASH = 'ad7bfe01539227981c48acb52d2731e276be72e64611310596d898445925dcf0';

/** Build an Ajv with every schema loaded (mirrors conformance.ts#createAjv). */
function omegaRecordValidator(): (d: unknown) => boolean {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const f of readdirSync(schemasDir).filter((n) => n.endsWith('.schema.json'))) {
    ajv.addSchema(JSON.parse(readFileSync(join(schemasDir, f), 'utf8')));
  }
  const v = ajv.getSchema('https://omegaprotocol.org/schemas/omega-record.schema.json');
  if (!v) throw new Error('omega-record schema not found');
  return v;
}

function baseRecord(): OmegaRecord {
  return {
    record_id: 'rec_prov_test',
    schema_version: 'omega/1.0',
    contracts_version: '0.3.0',
    created_at: '2026-06-12T00:00:00Z',
    subject: { domain: 'test', action: 'act', actor_id: 'actor_1', stakes: 'moderate' },
    outcome: { gate_result: 'COMMITTED', gate_reason: 'test', acted: true },
    previous_hash: null,
    content_hash: 'f'.repeat(64),
  };
}

const GOOD_HASH = fingerprint({ system: 'you are a clinician', user: 'L4-L5 advice' });

describe('P_VersionProvenance — hasVersionProvenance predicate', () => {
  it('true for a well-formed full generation block', () => {
    const r = baseRecord();
    r.generation = {
      model_id: 'claude',
      model_version: 'opus-4-8',
      prompt_hash: GOOD_HASH,
      tool_versions: { retriever: '1.2.0' },
    };
    expect(hasVersionProvenance(r)).toBe(true);
  });

  it('true with only the required pair (prompt_hash optional)', () => {
    const r = baseRecord();
    r.generation = { model_id: 'claude', model_version: 'opus-4-8' };
    expect(hasVersionProvenance(r)).toBe(true);
  });

  it('false when the block is absent (absence is evaluated, not schema-forced)', () => {
    expect(hasVersionProvenance(baseRecord())).toBe(false);
  });

  it('false when model_id is empty', () => {
    const r = baseRecord();
    r.generation = { model_id: '', model_version: 'opus-4-8' };
    expect(hasVersionProvenance(r)).toBe(false);
  });

  it('false when model_version is empty', () => {
    const r = baseRecord();
    r.generation = { model_id: 'claude', model_version: '' };
    expect(hasVersionProvenance(r)).toBe(false);
  });

  it('false when prompt_hash is present but malformed', () => {
    const r = baseRecord();
    r.generation = { model_id: 'claude', model_version: 'opus-4-8', prompt_hash: 'NOT-A-HASH' };
    expect(hasVersionProvenance(r)).toBe(false);
  });
});

describe('P_VersionProvenance — prompt_hash is a verifiable commitment', () => {
  it('verifyPromptHash matches the fingerprint of the supplied payload', () => {
    const payload = { system: 'you are a clinician', user: 'L4-L5 advice' };
    const r = baseRecord();
    r.generation = { model_id: 'claude', model_version: 'opus-4-8', prompt_hash: fingerprint(payload) };
    expect(verifyPromptHash(r, payload)).toBe(true);
    expect(verifyPromptHash(r, { system: 'tampered', user: 'L4-L5 advice' })).toBe(false);
  });

  it('verifyPromptHash is false when no prompt_hash is recorded', () => {
    const r = baseRecord();
    r.generation = { model_id: 'claude', model_version: 'opus-4-8' };
    expect(verifyPromptHash(r, { anything: true })).toBe(false);
  });
});

describe('P_VersionProvenance — schema (additive, backward-compatible)', () => {
  const validate = omegaRecordValidator();

  it('a record WITH a valid generation block validates', () => {
    const r = baseRecord();
    r.generation = { model_id: 'claude', model_version: 'opus-4-8', prompt_hash: GOOD_HASH };
    expect(validate(r)).toBe(true);
  });

  it('a record WITHOUT a generation block still validates (optional)', () => {
    expect(validate(baseRecord())).toBe(true);
  });

  it('a malformed prompt_hash is rejected by the schema', () => {
    const r = baseRecord() as Record<string, unknown>;
    r.generation = { model_id: 'claude', model_version: 'opus-4-8', prompt_hash: 'xyz' };
    expect(validate(r)).toBe(false);
  });

  it('a generation block missing model_version is rejected by the schema', () => {
    const r = baseRecord() as Record<string, unknown>;
    r.generation = { model_id: 'claude' };
    expect(validate(r)).toBe(false);
  });
});

describe('P_VersionProvenance — no interaction with gate_input_digest', () => {
  it('adding a generation block does NOT change gate_input_digest', () => {
    const without = baseRecord();
    const withGen = baseRecord();
    withGen.generation = {
      model_id: 'claude',
      model_version: 'opus-4-8',
      prompt_hash: GOOD_HASH,
      tool_versions: { retriever: '1.2.0' },
    };
    // generation is deliberately excluded from the gate-input evidence subset:
    expect(computeGateInputDigest(withGen)).toBe(computeGateInputDigest(without));
  });
});

describe('P_VersionProvenance — locked composition vector is unaffected', () => {
  const fixture = JSON.parse(
    readFileSync(new URL('../fixtures/composition/expected_record.json', import.meta.url), 'utf8'),
  ) as OmegaRecord & Record<string, unknown>;

  it('the composition fixture carries no generation block', () => {
    expect(fixture.generation).toBeUndefined();
    expect(hasVersionProvenance(fixture)).toBe(false);
  });

  it('content_hash has NOT moved (ad7bfe01…)', () => {
    expect(computeContentHash(fixture)).toBe(LOCKED_COMPOSITION_HASH);
    expect(fixture.content_hash).toBe(LOCKED_COMPOSITION_HASH);
  });

  it('the fixture still validates against the (now generation-aware) schema', () => {
    expect(omegaRecordValidator()(fixture)).toBe(true);
  });
});
