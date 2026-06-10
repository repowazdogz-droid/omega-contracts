import { fingerprint } from './encoding.js';
import type { OmegaRecord } from './omega-record.js';

/**
 * P5 gate evaluator — the deterministic function `f` over recorded inputs.
 *
 * HONEST SCOPE (PRIMITIVE_MAP register): `f` proves that `outcome.gate_result`
 * is the deterministic output of a declared, published function over fields
 * already in the record. A verifier can recompute `f(inputs)` and confirm it
 * equals the recorded `gate_result`. It does NOT prove the recorded inputs were
 * true, does NOT prove this policy is the correct or mandated policy, and does
 * NOT prove a human actually performed any escalation `f` demands. A cleared
 * escalation proves "an identified party, distinct from the acting actor,
 * recorded a cryptographically-bound approval scoped to specific triggers over
 * this record's evidence digest" — it does NOT prove that party was authorised,
 * competent, or honest (FAA-class limit, Attestation Authority Integrity), the
 * same trust hole as the unsigned actor_id. Hard-blocked conditions (R3, R4, R5)
 * are non-overridable by design.
 *
 * Mirrors lean-proof/OmegaP5Gate.lean. Keep the two in lockstep.
 */

export type GateResult = 'COMMITTED' | 'HELD' | 'ESCALATED';

export interface GateEvaluation {
  result: GateResult;
  /** The first rule that fired, e.g. 'R2' or 'R22' (the COMMITTED default). */
  rule: string;
  reason: string;
}

/** Policy constant (judgment call — needs empirical calibration; see edge cases). */
export const TRUST_FLOOR = 0.5;

/** Escalation triggers an attested oversight approval may clear. */
export const CLEARABLE_TRIGGERS = ['R1', 'R2', 'R6', 'R7'] as const;

/** Hard escalation triggers — never clearable by any oversight block. */
export const HARD_TRIGGERS = ['R3', 'R4', 'R5'] as const;

/** Evidence slots included in the gate-input digest, in stable order. */
const EVIDENCE_SLOTS = [
  'clearpath',
  'cognitive',
  'consent',
  'harm',
  'assumption',
  'dispute',
  'ethics',
  'trust',
] as const;

/**
 * gate_input_digest = sha256 over the RFC 8785 canonical JSON of
 * { subject } + the present evidence slots. Excludes outcome, provenance,
 * previous_hash, content_hash, signature, human_oversight, and the envelope
 * version/id/time fields. This is exactly the input `f` reads; binding the
 * oversight approval to it (guard G3) stops an approval being transplanted
 * from another record.
 */
export function computeGateInputDigest(record: OmegaRecord): string {
  const subset: Record<string, unknown> = { subject: record.subject };
  for (const slot of EVIDENCE_SLOTS) {
    const value = (record as unknown as Record<string, unknown>)[slot];
    if (value !== undefined) {
      subset[slot] = value;
    }
  }
  return fingerprint(subset);
}

/**
 * G4. Cryptographic attestation of the oversight record. The actor/seal
 * signature-binding layer (build step 3) supplies the real verifier. Until then
 * this is hard-wired `false` — FAIL-CLOSED. No unattested oversight clears any
 * escalation; ESCALATED is, in effect, still absorbing today. The rule SHAPE is
 * final, so swapping in the real verifier needs no change to `f`'s precedence.
 */
function oversightAttested(_record: OmegaRecord): boolean {
  return false;
}

/** Per-guard breakdown of an oversight clear attempt, for audit and testing. */
export interface OversightGuardReport {
  present: boolean;
  disposition_approved: boolean;
  g1_separation: boolean;
  g2_scoping: boolean;
  g3_binding: boolean;
  g4_attestation: boolean;
  cleared: boolean;
}

/**
 * Inspect every guard for a given trigger. G1–G3 are live and deterministic;
 * G4 is fail-closed (always false today). `cleared` is the conjunction — so it
 * is always false until the step-3 signature layer makes G4 real.
 */
export function inspectOversight(record: OmegaRecord, trigger: string): OversightGuardReport {
  const ov = record.outcome.human_oversight;
  if (ov === undefined) {
    return {
      present: false,
      disposition_approved: false,
      g1_separation: false,
      g2_scoping: false,
      g3_binding: false,
      g4_attestation: false,
      cleared: false,
    };
  }
  const disposition_approved = ov.disposition === 'approved';
  const g1 = ov.approver_id !== record.subject.actor_id; // separation of duties
  const g2 = ov.cleared_triggers.includes(trigger); // scoping
  const g3 = ov.gate_input_digest === computeGateInputDigest(record); // anti-transplant
  const g4 = oversightAttested(record); // attestation (fail-closed)
  return {
    present: true,
    disposition_approved,
    g1_separation: g1,
    g2_scoping: g2,
    g3_binding: g3,
    g4_attestation: g4,
    cleared: disposition_approved && g1 && g2 && g3 && g4,
  };
}

/**
 * OversightCleared(trigger): true only if disposition = approved AND all four
 * guards hold. Only ever consulted for clearable triggers {R1, R2, R6, R7};
 * hard triggers never call it, so they are unclearable by construction.
 */
function oversightCleared(record: OmegaRecord, trigger: string): boolean {
  return inspectOversight(record, trigger).cleared;
}

function evaluation(result: GateResult, rule: string, reason: string): GateEvaluation {
  return { result, rule, reason };
}

/**
 * The R1–R22 ordered rule list, first match wins. Total and single-valued: every
 * predicate is a decidable comparison over a recorded value (or false on slot
 * absence), and R22 is an unconditional default.
 */
export function evaluateGate(record: OmegaRecord): GateEvaluation {
  const cleared = (t: string): boolean => oversightCleared(record, t);

  const stakes = record.subject.stakes;
  const elevated = stakes === 'high' || stakes === 'critical';
  const nontrivial = stakes === 'moderate' || elevated;

  const a = record.assumption;
  const c = record.consent;
  const e = record.ethics;
  const h = record.harm;
  const t = record.trust;
  const cp = record.clearpath;

  // ── ESCALATED — clearable ────────────────────────────────────────────────
  if (record.outcome.blocked_by !== undefined && !cleared('R1')) {
    return evaluation('ESCALATED', 'R1', 'blocked_by present (no attested override)');
  }
  if ((e?.outcome_distribution.requires_human_review ?? 0) > 0 && !cleared('R2')) {
    return evaluation('ESCALATED', 'R2', 'ethics requires_human_review > 0 (no attested approval)');
  }

  // ── ESCALATED — hard (never clearable) ───────────────────────────────────
  if ((e?.outcome_distribution.flag_critical ?? 0) > 0 || (e?.weaponisation_concerns ?? 0) > 0) {
    return evaluation('ESCALATED', 'R3', 'critical ethics flag or weaponisation concern (hard block)');
  }
  if (h?.max_severity_label === 'critical' || h?.max_severity_label === 'catastrophic') {
    return evaluation('ESCALATED', 'R4', 'harm severity critical/catastrophic (hard block)');
  }
  if ((c?.violations_by_severity.critical ?? 0) > 0) {
    return evaluation('ESCALATED', 'R5', 'critical consent violation (hard block)');
  }

  // ── ESCALATED — clearable (critical-stakes assumption gaps) ──────────────
  if (stakes === 'critical' && a !== undefined &&
      a.load_bearing_count - a.load_bearing_validated > 0 && !cleared('R6')) {
    return evaluation('ESCALATED', 'R6', 'critical stakes with unvalidated load-bearing assumptions (no attested approval)');
  }
  if (stakes === 'critical' && a === undefined && !cleared('R7')) {
    return evaluation('ESCALATED', 'R7', 'critical stakes with no assumption gate (no attested approval)');
  }

  // ── HELD — mechanical (not oversight-clearable) ──────────────────────────
  if ((cp?.verification_failures ?? 0) > 0) {
    return evaluation('HELD', 'R8', 'clearpath verification failures');
  }
  if (a?.pre_action_gate === 'block') {
    return evaluation('HELD', 'R9', 'assumption pre_action_gate = block');
  }
  if (c !== undefined && c.source_chain_verified === false) {
    return evaluation('HELD', 'R10', 'consent source chain not verified');
  }
  if ((c?.violations_by_severity.major ?? 0) > 0) {
    return evaluation('HELD', 'R11', 'major consent violation');
  }
  if ((e?.outcome_distribution.flag_major ?? 0) > 0 || (e?.unacknowledged_flags ?? 0) > 0) {
    return evaluation('HELD', 'R12', 'major ethics flag or unacknowledged flags');
  }
  if (h?.max_severity_label === 'severe') {
    return evaluation('HELD', 'R13', 'harm severity severe');
  }
  if (h !== undefined && h.max_severity_label === null && nontrivial) {
    return evaluation('HELD', 'R14', 'harm present with unknown severity at nontrivial stakes');
  }
  if (stakes === 'high' && a !== undefined &&
      a.load_bearing_count - a.load_bearing_validated > 0) {
    return evaluation('HELD', 'R15', 'high stakes with unvalidated load-bearing assumptions');
  }
  if (a?.pre_action_gate === 'caution' && elevated) {
    return evaluation('HELD', 'R16', 'assumption caution at elevated stakes');
  }
  if (t !== undefined && t.overall_availability === 'available' &&
      t.overall_score !== null && t.overall_score < TRUST_FLOOR && elevated) {
    return evaluation('HELD', 'R17', 'trust below floor at elevated stakes');
  }
  if (t !== undefined &&
      !(t.overall_availability === 'available' && t.overall_score !== null) &&
      stakes === 'critical') {
    return evaluation('HELD', 'R18', 'trust insufficient at critical stakes');
  }
  if (elevated && (c === undefined || e === undefined || h === undefined)) {
    return evaluation('HELD', 'R19', 'missing consent/ethics/harm evidence at elevated stakes');
  }
  if (c?.scope_creep_detected === true && elevated) {
    return evaluation('HELD', 'R20', 'consent scope creep at elevated stakes');
  }
  if ((c?.violations ?? 0) > 0 && stakes === 'critical') {
    return evaluation('HELD', 'R21', 'any consent violation at critical stakes');
  }

  // ── COMMITTED — default ──────────────────────────────────────────────────
  return evaluation('COMMITTED', 'R22', 'no disqualifying condition');
}
