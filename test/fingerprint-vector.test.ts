import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fingerprint } from '../src/encoding.js';

const vectorPath = join(import.meta.dirname, '../fixtures/specgap/fingerprint_vector.json');

describe('specgap fingerprint vector', () => {
  it('matches contracts fingerprint() on ingress', () => {
    const data = JSON.parse(readFileSync(vectorPath, 'utf8')) as {
      ingress: Record<string, string>;
      input_fingerprint: string;
    };
    expect(data.input_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint(data.ingress)).toBe(data.input_fingerprint);
  });
});
