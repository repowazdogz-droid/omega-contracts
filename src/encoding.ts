import canonicalizeValue from 'canonicalize';
import { createHash } from 'node:crypto';

export const canonicalize = canonicalizeValue;

function canonicalizeOrThrow(value: unknown): string {
  const canonical = canonicalizeValue(value);
  if (typeof canonical !== 'string') {
    throw new TypeError('Value cannot be represented as RFC 8785 canonical JSON');
  }
  return canonical;
}

export function computeContentHash(
  record: Record<string, unknown> & {
    content_hash?: string;
    signature?: string;
  },
): string {
  const { content_hash: _contentHash, signature: _signature, ...hashable } = record;
  return createHash('sha256').update(canonicalizeOrThrow(hashable), 'utf8').digest('hex');
}

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalizeOrThrow(value), 'utf8').digest('hex');
}
