import { describe, expect, it } from 'vitest';
import { runConformance } from '../src/conformance.js';

describe('conformance runner', () => {
  it('passes the C3 composition fixture self-test', async () => {
    const result = await runConformance('fixtures/composition', 'C3');

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'self-test omega-record schema validation',
          passed: true,
        }),
        expect.objectContaining({
          name: 'self-test content_hash reproducibility',
          passed: true,
        }),
        expect.objectContaining({
          name: 'self-test no adapter timestamps in canonical fixtures',
          passed: true,
        }),
      ]),
    );
  });
});
