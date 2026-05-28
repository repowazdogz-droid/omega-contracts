import { describe, expect, it } from 'vitest';
import { runConformance } from '../src/conformance.js';
import { fingerprint } from '../src/encoding.js';
import { specgapAssuranceAdapter } from '../src/assurance.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixtureDir = join(import.meta.dirname, '../fixtures/specgap');

describe('specgapAssuranceAdapter', () => {
  it('passes C1 conformance against published fixtures', async () => {
    const root = join(import.meta.dirname, '..');
    const result = await runConformance(root, 'C1');
    const specgapChecks = result.checks.filter((c) =>
      c.name.includes('C1') && !c.message?.startsWith('pending'),
    );
    expect(result.passed).toBe(true);
    expect(specgapChecks.every((c) => c.passed)).toBe(true);
  });

  it('native ingress fingerprint matches cross-language vector', () => {
    const vector = JSON.parse(
      readFileSync(join(fixtureDir, 'fingerprint_vector.json'), 'utf8'),
    ) as { ingress: Record<string, string>; input_fingerprint: string };
    const native = JSON.parse(
      readFileSync(join(fixtureDir, 'native.sample.json'), 'utf8'),
    ) as Array<{ ingress: Record<string, string> }>;
    expect(specgapAssuranceAdapter.fingerprint(native)).toBe(vector.input_fingerprint);
    expect(fingerprint(native[0].ingress)).toBe(vector.input_fingerprint);
  });
});
