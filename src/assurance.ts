/**
 * Assurance layer → @omega-protocol/contracts canonical summaries.
 *
 * Native: SpecGap ingress + full AssuranceResult envelope from analyze_structured.
 * Canonical: summarized AssuranceResult for OmegaRecord.assurance (C2 pending).
 */

import type { ProtocolAdapter } from './adapter.js';
import { fingerprint } from './encoding.js';
import type { DataAvailability, DerivedFieldProvenance } from './shared.js';

export const SPECGAP_CONTRACTS_VERSION = '0.2.2';

/** Spec triple used for ingress fingerprinting (matches specgap.specgap_input_payload). */
export interface SpecgapIngress {
  title: string;
  stakeholder_intent: string;
  formalized_policy: string;
  implementation_claim: string;
}

/** Full artifact envelope from specgap.analyze_structured (kind=specgap). */
export interface SpecgapArtifactEnvelope {
  assurance_result_schema: '1.0';
  kind: 'specgap';
  producer: { name: string; version: string };
  input_fingerprint: string;
  verdict: 'extraction_failure' | 'divergence_detected' | 'no_divergence_detected';
  availability: Record<string, string>;
  detail: SpecgapArtifactDetail;
}

export interface SpecgapArtifactDetail {
  specgap_detail_schema: '1.0';
  extractor_mode: 'rule' | 'fuzzy';
  encoding_version: string;
  intent_empty: boolean;
  counts: {
    semantic_divergences: number;
    high_severity_divergences: number;
    failed_implication_checks: number;
    implication_checks_total: number;
    inconsistent_layers: number;
  };
  triangulation: {
    intent_empty: boolean;
    any_disagreement: boolean;
    records: unknown[];
  };
}

export interface NativeSpecgapAssurance {
  ingress: SpecgapIngress;
  envelope: SpecgapArtifactEnvelope;
}

export interface SpecgapAssuranceSummary {
  encoding_version: string;
  extractor_mode: 'rule' | 'fuzzy';
  intent_empty: boolean;
  semantic_divergence_count: number;
  high_severity_divergence_count: number;
  failed_implication_checks: number;
  implication_checks_total: number;
  inconsistent_layers: number;
  triangulation_any_disagreement: boolean;
}

export interface AssuranceResult {
  kind: 'specgap';
  producer_name: string;
  producer_version: string;
  input_fingerprint: string;
  verdict: SpecgapArtifactEnvelope['verdict'];
  availability: Record<string, DataAvailability>;
  specgap: SpecgapAssuranceSummary;
  provenance?: DerivedFieldProvenance[];
}

function buildProvenance(fp: string): DerivedFieldProvenance[] {
  return [
    {
      field: 'failed_implication_checks',
      method: 'specgap.analyze_structured/1.0: counts.failed_implication_checks',
      inputs: ['ingress'],
      confidence: 1,
      input_fingerprint: fp,
    },
    {
      field: 'triangulation_any_disagreement',
      method: 'specgap.analyze_structured/1.0: triangulation.any_disagreement',
      inputs: ['ingress'],
      confidence: 1,
      input_fingerprint: fp,
    },
  ];
}

function emptyAvailability(): AssuranceResult['availability'] {
  return {
    verdict: 'not_collected',
    input_fingerprint: 'not_collected',
    intent_empty: 'not_collected',
    semantic_divergence_count: 'not_collected',
    failed_implication_checks: 'not_collected',
    triangulation_any_disagreement: 'not_collected',
    encoding_version: 'not_collected',
  };
}

export function toAssuranceResultFromNative(record: NativeSpecgapAssurance): AssuranceResult {
  const { ingress, envelope } = record;
  const detail = envelope.detail;
  const fp = fingerprint(ingress);

  const specgap: SpecgapAssuranceSummary = {
    encoding_version: detail.encoding_version,
    extractor_mode: detail.extractor_mode,
    intent_empty: detail.intent_empty,
    semantic_divergence_count: detail.counts.semantic_divergences,
    high_severity_divergence_count: detail.counts.high_severity_divergences,
    failed_implication_checks: detail.counts.failed_implication_checks,
    implication_checks_total: detail.counts.implication_checks_total,
    inconsistent_layers: detail.counts.inconsistent_layers,
    triangulation_any_disagreement: detail.triangulation.any_disagreement,
  };

  return {
    kind: 'specgap',
    producer_name: envelope.producer.name,
    producer_version: envelope.producer.version,
    input_fingerprint: fp,
    verdict: envelope.verdict,
    availability: {
      verdict: 'available',
      input_fingerprint: 'available',
      intent_empty: 'available',
      semantic_divergence_count: 'available',
      failed_implication_checks: 'available',
      triangulation_any_disagreement: 'available',
      encoding_version: 'available',
    },
    specgap,
    provenance: buildProvenance(fp),
  };
}

function validateAssuranceResult(
  shape: AssuranceResult,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (shape.kind !== 'specgap') {
    errors.push('kind must be specgap');
  }
  if (!/^[a-f0-9]{64}$/.test(shape.input_fingerprint)) {
    errors.push('input_fingerprint must be 64 lowercase hex');
  }
  if (!shape.specgap) {
    errors.push('specgap summary required');
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

/** Conformance adapter for SpecGap assurance (C0+C1). */
export const specgapAssuranceAdapter: ProtocolAdapter<NativeSpecgapAssurance, AssuranceResult> = {
  protocolId: 'specgap',
  protocolVersion: '0.1.0',
  contractsVersion: SPECGAP_CONTRACTS_VERSION,
  canonicalShape: 'AssuranceResult',

  toCanonical(records: NativeSpecgapAssurance[]): AssuranceResult {
    if (records.length === 0) {
      return {
        kind: 'specgap',
        producer_name: 'specgap',
        producer_version: '0.1.0',
        input_fingerprint: fingerprint({}),
        verdict: 'no_divergence_detected',
        availability: emptyAvailability(),
        specgap: {
          encoding_version: 'sandbox-propositional/1.0',
          extractor_mode: 'rule',
          intent_empty: true,
          semantic_divergence_count: 0,
          high_severity_divergence_count: 0,
          failed_implication_checks: 0,
          implication_checks_total: 0,
          inconsistent_layers: 0,
          triangulation_any_disagreement: false,
        },
      };
    }
    const first = records[0];
    if (!first) {
      throw new Error('native record missing after non-empty length check');
    }
    return toAssuranceResultFromNative(first);
  },

  validate(shape: AssuranceResult): { ok: true } | { ok: false; errors: string[] } {
    return validateAssuranceResult(shape);
  },

  fingerprint(records: NativeSpecgapAssurance[]): string {
    if (records.length === 0) {
      return fingerprint({});
    }
    const first = records[0];
    if (!first) {
      return fingerprint({});
    }
    return fingerprint(first.ingress);
  },
};
