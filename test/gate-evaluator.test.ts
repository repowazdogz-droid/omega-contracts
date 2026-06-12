import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  computeGateInputDigest,
  evaluateGate,
  inspectOversight,
  TRUST_FLOOR,
} from '../src/gate-evaluator.js';
import type { OmegaRecord } from '../src/omega-record.js';

const HASH64 = 'f'.repeat(64);

/** Minimal schema-shaped record with no evidence slots. */
function baseRecord(stakes: OmegaRecord['subject']['stakes']): OmegaRecord {
  return {
    record_id: 'rec_test',
    schema_version: 'omega/1.0',
    contracts_version: '0.2.2',
    created_at: '2026-06-10T00:00:00Z',
    subject: { domain: 'test', action: 'act', actor_id: 'actor_1', stakes },
    outcome: { gate_result: 'COMMITTED', gate_reason: 'test', acted: true },
    previous_hash: null,
    content_hash: HASH64,
  };
}

/** A fully-valid-on-G1G2G3 oversight block for `trigger` on `record`. */
function validOversight(record: OmegaRecord, trigger: string) {
  return {
    disposition: 'approved' as const,
    approver_id: 'approver_distinct', // ≠ actor_1  → G1 holds
    cleared_triggers: [trigger], //              → G2 holds
    gate_input_digest: computeGateInputDigest(record), // → G3 holds
    oversight_record_ref: 'oversight_ledger://1',
    attestation: 'sig_placeholder',
  };
}

describe('P5 gate evaluator — f', () => {
  // ── (a) each rule firing in isolation ────────────────────────────────────
  describe('(a) each rule fires in isolation', () => {
    it('R1 blocked_by → ESCALATED', () => {
      const r = baseRecord('low');
      r.outcome.blocked_by = 'ethics-gate';
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R1' });
    });

    it('R2 requires_human_review → ESCALATED', () => {
      const r = baseRecord('low');
      r.ethics = ethics({ requires_human_review: 1 });
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R2' });
    });

    it('R3 weaponisation → ESCALATED (hard)', () => {
      const r = baseRecord('low');
      r.ethics = ethics({ weaponisation_concerns: 1 });
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R3' });
    });

    it('R3 flag_critical → ESCALATED (hard)', () => {
      const r = baseRecord('low');
      r.ethics = ethics({ flag_critical: 1 });
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R3' });
    });

    it('R4 harm catastrophic → ESCALATED (hard)', () => {
      const r = baseRecord('low');
      r.harm = harm('catastrophic');
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R4' });
    });

    it('R5 critical consent violation → ESCALATED (hard)', () => {
      const r = baseRecord('low');
      r.consent = consent({ critical: 1 });
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R5' });
    });

    it('R6 critical stakes + unvalidated load-bearing → ESCALATED', () => {
      const r = baseRecord('critical');
      r.assumption = assumption({ load_bearing_count: 2, load_bearing_validated: 1 });
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R6' });
    });

    it('R7 critical stakes + no assumption gate → ESCALATED', () => {
      const r = baseRecord('critical');
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R7' });
    });

    it('R8 clearpath verification failures → HELD', () => {
      const r = baseRecord('low');
      r.clearpath = clearpath({ verification_failures: 1 });
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R8' });
    });

    it('R9 assumption block → HELD', () => {
      const r = baseRecord('low');
      r.assumption = assumption({ pre_action_gate: 'block' });
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R9' });
    });

    it('R10 consent chain unverified → HELD', () => {
      const r = baseRecord('low');
      r.consent = consent({ source_chain_verified: false });
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R10' });
    });

    it('R11 major consent violation → HELD', () => {
      const r = baseRecord('low');
      r.consent = consent({ major: 1 });
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R11' });
    });

    it('R12 unacknowledged flags → HELD', () => {
      const r = baseRecord('low');
      r.ethics = ethics({ unacknowledged_flags: 1 });
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R12' });
    });

    it('R13 harm severe → HELD', () => {
      const r = baseRecord('low');
      r.harm = harm('severe');
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R13' });
    });

    it('R14 harm present, severity unknown, nontrivial stakes → HELD', () => {
      const r = baseRecord('moderate');
      r.harm = harm(null);
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R14' });
    });

    it('R15 high stakes + unvalidated load-bearing → HELD', () => {
      const r = baseRecord('high');
      r.assumption = assumption({ load_bearing_count: 3, load_bearing_validated: 1 });
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R15' });
    });

    it('R16 caution at elevated stakes → HELD', () => {
      const r = baseRecord('high');
      r.assumption = assumption({ pre_action_gate: 'caution' });
      // include consent/ethics/harm so R19 (missing-evidence) does not pre-empt
      r.consent = consent({});
      r.ethics = ethics({});
      r.harm = harm('negligible');
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R16' });
    });

    it('R17 trust below floor at elevated stakes → HELD', () => {
      const r = baseRecord('high');
      r.consent = consent({});
      r.ethics = ethics({});
      r.harm = harm('negligible');
      r.trust = trust(TRUST_FLOOR - 0.01);
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R17' });
    });

    it('R18 trust insufficient at critical stakes → HELD', () => {
      const r = baseRecord('critical');
      r.assumption = assumption({ load_bearing_count: 1, load_bearing_validated: 1 }); // pass R6/R7
      r.consent = consent({});
      r.ethics = ethics({});
      r.harm = harm('negligible');
      r.trust = { ...trust(null), overall_availability: 'insufficient_history' };
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R18' });
    });

    it('R19 missing evidence at elevated stakes → HELD', () => {
      const r = baseRecord('high');
      // no consent/ethics/harm slots
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R19' });
    });

    it('R20 scope creep at elevated stakes → HELD', () => {
      const r = baseRecord('high');
      r.consent = consent({ scope_creep_detected: true });
      r.ethics = ethics({});
      r.harm = harm('negligible');
      r.trust = trust(0.9);
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R20' });
    });

    it('R21 any consent violation at critical stakes → HELD', () => {
      const r = baseRecord('critical');
      r.assumption = assumption({ load_bearing_count: 1, load_bearing_validated: 1 });
      r.consent = consent({ violations: 1, minor: 1 });
      r.ethics = ethics({});
      r.harm = harm('negligible');
      r.trust = trust(0.9);
      expect(evaluateGate(r)).toMatchObject({ result: 'HELD', rule: 'R21' });
    });

    it('R22 benign record → COMMITTED', () => {
      const r = baseRecord('low');
      expect(evaluateGate(r)).toMatchObject({ result: 'COMMITTED', rule: 'R22' });
    });
  });

  // ── (b) precedence: first match wins ─────────────────────────────────────
  describe('(b) precedence — first match wins', () => {
    it('R1 precedes R2 (blocked_by + human review → R1)', () => {
      const r = baseRecord('low');
      r.outcome.blocked_by = 'ethics-gate';
      r.ethics = ethics({ requires_human_review: 1 });
      expect(evaluateGate(r).rule).toBe('R1');
    });

    it('R2 precedes R3 (human review + weaponisation → R2)', () => {
      const r = baseRecord('low');
      r.ethics = ethics({ requires_human_review: 1, weaponisation_concerns: 1 });
      expect(evaluateGate(r).rule).toBe('R2');
    });

    it('hard R3 precedes clearable R6/R7 at critical stakes', () => {
      const r = baseRecord('critical'); // no assumption → R7 candidate
      r.ethics = ethics({ flag_critical: 1 });
      expect(evaluateGate(r).rule).toBe('R3');
    });

    it('ESCALATED block precedes HELD block (R5 over R9)', () => {
      const r = baseRecord('low');
      r.consent = consent({ critical: 1 });
      r.assumption = assumption({ pre_action_gate: 'block' });
      expect(evaluateGate(r).rule).toBe('R5');
    });
  });

  // ── (c) four guards individually failing → no clear ──────────────────────
  describe('(c) oversight guards G1–G3 each failing → not cleared', () => {
    function r2Record(): OmegaRecord {
      const r = baseRecord('low');
      r.ethics = ethics({ requires_human_review: 1 });
      return r;
    }

    it('G1 fails (approver == actor) → not cleared', () => {
      const r = r2Record();
      r.outcome.human_oversight = { ...validOversight(r, 'R2'), approver_id: 'actor_1' };
      const g = inspectOversight(r, 'R2');
      expect(g.g1_separation).toBe(false);
      expect(g.cleared).toBe(false);
    });

    it('G2 fails (trigger not in cleared_triggers) → not cleared', () => {
      const r = r2Record();
      r.outcome.human_oversight = { ...validOversight(r, 'R2'), cleared_triggers: ['R6'] };
      const g = inspectOversight(r, 'R2');
      expect(g.g2_scoping).toBe(false);
      expect(g.cleared).toBe(false);
    });

    it('G3 fails (digest does not match this record) → not cleared', () => {
      const r = r2Record();
      r.outcome.human_oversight = { ...validOversight(r, 'R2'), gate_input_digest: '0'.repeat(64) };
      const g = inspectOversight(r, 'R2');
      expect(g.g3_binding).toBe(false);
      expect(g.cleared).toBe(false);
    });

    it('G4 fails (fail-closed) even when G1–G3 all hold → not cleared', () => {
      const r = r2Record();
      r.outcome.human_oversight = validOversight(r, 'R2');
      const g = inspectOversight(r, 'R2');
      expect(g.g1_separation).toBe(true);
      expect(g.g2_scoping).toBe(true);
      expect(g.g3_binding).toBe(true);
      expect(g.g4_attestation).toBe(false); // fail-closed until step 3
      expect(g.cleared).toBe(false);
      // and the gate therefore still escalates
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R2' });
    });
  });

  // ── (d) disposition = rejected never clears ──────────────────────────────
  it('(d) disposition = rejected never clears', () => {
    const r = baseRecord('low');
    r.ethics = ethics({ requires_human_review: 1 });
    r.outcome.human_oversight = { ...validOversight(r, 'R2'), disposition: 'rejected' };
    expect(inspectOversight(r, 'R2').disposition_approved).toBe(false);
    expect(inspectOversight(r, 'R2').cleared).toBe(false);
    expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R2' });
  });

  // ── (e) hard rules unclearable even with a "valid" oversight block ────────
  describe('(e) hard blocks R3/R4/R5 are unclearable by construction', () => {
    it('R3 stays ESCALATED with oversight listing R3', () => {
      const r = baseRecord('low');
      r.ethics = ethics({ weaponisation_concerns: 1 });
      r.outcome.human_oversight = validOversight(r, 'R3');
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R3' });
    });

    it('R4 stays ESCALATED with oversight listing R4', () => {
      const r = baseRecord('low');
      r.harm = harm('critical');
      r.outcome.human_oversight = validOversight(r, 'R4');
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R4' });
    });

    it('R5 stays ESCALATED with oversight listing R5', () => {
      const r = baseRecord('low');
      r.consent = consent({ critical: 1 });
      r.outcome.human_oversight = validOversight(r, 'R5');
      expect(evaluateGate(r)).toMatchObject({ result: 'ESCALATED', rule: 'R5' });
    });
  });

  // ── (f) composition fixture is CONSISTENT with f ─────────────────────────
  it('(f) composition fixture records ESCALATED (R2) and f agrees — recorded gate_result is re-checkable', () => {
    const fixture = JSON.parse(
      readFileSync(new URL('../fixtures/composition/expected_record.json', import.meta.url), 'utf8'),
    ) as OmegaRecord;

    // The recorded outcome and the deterministic evaluator now agree:
    expect(fixture.outcome.gate_result).toBe('ESCALATED'); // what is recorded
    const evaluated = evaluateGate(fixture);
    expect(evaluated).toMatchObject({ result: 'ESCALATED', rule: 'R2' }); // what f says
    expect(evaluated.result).toBe(fixture.outcome.gate_result); // recorded == recomputed
  });
});

// ── tiny builders for the evidence slots ───────────────────────────────────

function ethics(o: Partial<{
  pass: number; flag_minor: number; flag_major: number; flag_critical: number;
  requires_human_review: number; unacknowledged_flags: number;
  vulnerable_population_concerns: number; weaponisation_concerns: number;
}>): OmegaRecord['ethics'] {
  return {
    total_reviews: 1,
    outcome_distribution: {
      pass: o.pass ?? 1,
      flag_minor: o.flag_minor ?? 0,
      flag_major: o.flag_major ?? 0,
      flag_critical: o.flag_critical ?? 0,
      requires_human_review: o.requires_human_review ?? 0,
    },
    unacknowledged_flags: o.unacknowledged_flags ?? 0,
    vulnerable_population_concerns: o.vulnerable_population_concerns ?? 0,
    weaponisation_concerns: o.weaponisation_concerns ?? 0,
    availability: {},
  };
}

function consent(o: Partial<{
  violations: number; critical: number; major: number; minor: number;
  scope_creep_detected: boolean; source_chain_verified: boolean;
}>): OmegaRecord['consent'] {
  return {
    total_actions: 1,
    violations: o.violations ?? 0,
    violations_by_severity: { critical: o.critical ?? 0, major: o.major ?? 0, minor: o.minor ?? 0 },
    scope_creep_detected: o.scope_creep_detected ?? false,
    scope_creep_pattern_count: 0,
    authorisations_active: 1,
    authorisations_expired: 0,
    source_chain_verified: o.source_chain_verified ?? true,
    availability: {},
  };
}

function harm(label: NonNullable<OmegaRecord['harm']>['max_severity_label']): OmegaRecord['harm'] {
  return {
    total_incidents: 1,
    max_severity: label === null ? null : 0.5,
    max_severity_label: label,
    severity_distribution: {},
    remediation_rate: 1,
    pending_remediations: 0,
    consequence_chain_count: 0,
    availability: {},
  };
}

function assumption(o: Partial<{
  load_bearing_count: number; load_bearing_validated: number;
  pre_action_gate: 'pass' | 'caution' | 'block';
}>): OmegaRecord['assumption'] {
  return {
    total_assumptions: 1,
    load_bearing_count: o.load_bearing_count ?? 0,
    load_bearing_validated: o.load_bearing_validated ?? 0,
    validation_ratio: 1,
    expired_assumptions: 0,
    cascade_risks: 0,
    pre_action_gate: o.pre_action_gate ?? 'pass',
    pre_action_reasons: [],
    availability: {},
  };
}

function clearpath(o: Partial<{ verification_failures: number }>): OmegaRecord['clearpath'] {
  return {
    total_traces: 1,
    verification_failures: o.verification_failures ?? 0,
    assumption_ratio: 0,
    alternatives_considered_avg: 1,
    faithfulness_distribution: { verified_faithful: 1, narrative: 0, unverified: 0, disputed: 0 },
    availability: {},
  };
}

function trust(score: number | null): OmegaRecord['trust'] {
  const dim = {
    raw_score: score, score, confidence: 0.7, evidence_count: 1,
    last_updated: '2026-06-10T00:00:00Z', availability: 'available' as const,
  };
  return {
    actor_id: 'actor_1',
    computed_at: '2026-06-10T00:00:00Z',
    overall_score: score,
    overall_availability: 'available',
    dimensions: {
      transparency: dim, calibration: dim, consistency: dim, consent_compliance: dim,
      harm_record: dim, assumption_discipline: dim, dispute_record: dim, ethics_record: dim,
    },
    evidence_sources: [],
    decay_applied: false,
  };
}
