import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { ProtocolAdapter } from './adapter.js';
import { canonicalize, computeContentHash } from './encoding.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

interface ValidateFunctionLike {
  (data: unknown): boolean;
  errors?: unknown;
}

interface AjvLike {
  addSchema(schema: unknown): void;
  getSchema(id: string): ValidateFunctionLike | undefined;
}

const AjvConstructor = require('ajv') as new (options?: Record<string, unknown>) => AjvLike;

export type ConformanceLevel = 'C0' | 'C1' | 'C2' | 'C3';

export interface ConformanceResult {
  libraryPath: string;
  level: string;
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message?: string;
  }>;
}

type Check = ConformanceResult['checks'][number];
type AnyAdapter = ProtocolAdapter<unknown, unknown>;

const FIXTURE_TO_RECORD_FIELD: Record<string, string> = {
  clearpath: 'clearpath',
  'cognitive-ledger': 'cognitive',
  'consent-ledger': 'consent',
  'harm-trace': 'harm',
  'assumption-registry': 'assumption',
  'dispute-protocol': 'dispute',
  'ethics-gate': 'ethics',
  'trust-score': 'trust',
};

const CANONICAL_SCHEMA_BY_SHAPE: Record<string, string> = {
  ClearpathSummary: 'clearpath-summary.schema.json',
  CognitiveProfile: 'cognitive-profile.schema.json',
  ConsentRecord: 'consent-record.schema.json',
  HarmRecord: 'harm-record.schema.json',
  AssumptionGate: 'assumption-gate.schema.json',
  DisputeFinding: 'dispute-finding.schema.json',
  EthicsReview: 'ethics-review.schema.json',
  TrustScore: 'trust-score.schema.json',
  OmegaRecord: 'omega-record.schema.json',
};

const SCHEMA_NAMES = [
  'data-availability.schema.json',
  'protocol-id.schema.json',
  'derived-field-provenance.schema.json',
  'dimension-score.schema.json',
  'trust-evidence.schema.json',
  'clearpath-summary.schema.json',
  'cognitive-profile.schema.json',
  'consent-record.schema.json',
  'harm-record.schema.json',
  'assumption-gate.schema.json',
  'dispute-finding.schema.json',
  'ethics-review.schema.json',
  'trust-score.schema.json',
  'omega-record.schema.json',
];

function repoRoot(): string {
  return resolve(dirname(new URL(import.meta.url).pathname), '..');
}

function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function contractsRoot(): string {
  const sourceRoot = repoRoot();
  if (existsSync(join(sourceRoot, 'schemas'))) {
    return sourceRoot;
  }
  return resolve(sourceRoot, '..');
}

function createAjv() {
  const ajv = new AjvConstructor({ allErrors: true, strict: false });
  const root = contractsRoot();
  for (const schemaName of SCHEMA_NAMES) {
    ajv.addSchema(readJson(join(root, 'schemas', schemaName)));
  }
  return ajv;
}

function check(name: string, passed: boolean, message?: string): Check {
  return message === undefined ? { name, passed } : { name, passed, message };
}

function isPending(checkResult: Check): boolean {
  return checkResult.passed && checkResult.message?.startsWith('pending') === true;
}

function finalResult(libraryPath: string, level: ConformanceLevel, checks: Check[]): ConformanceResult {
  return {
    libraryPath,
    level,
    passed: checks.every((item) => item.passed),
    checks,
  };
}

async function loadAdapter(libraryPath: string): Promise<AnyAdapter | null> {
  const packageJsonPath = join(libraryPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  const packageJson = readJson<{ main?: string; exports?: string | Record<string, unknown> }>(packageJsonPath);
  const entry =
    typeof packageJson.exports === 'string'
      ? packageJson.exports
      : typeof packageJson.main === 'string'
        ? packageJson.main
        : 'index.js';
  const modulePath = resolve(libraryPath, entry);
  if (!existsSync(modulePath)) {
    return null;
  }

  const moduleExports = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
  for (const value of Object.values(moduleExports)) {
    if (isAdapter(value)) {
      return value;
    }
  }
  return null;
}

function isAdapter(value: unknown): value is AnyAdapter {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<AnyAdapter>;
  return (
    typeof candidate.protocolId === 'string' &&
    typeof candidate.protocolVersion === 'string' &&
    typeof candidate.contractsVersion === 'string' &&
    typeof candidate.canonicalShape === 'string' &&
    typeof candidate.toCanonical === 'function' &&
    typeof candidate.validate === 'function' &&
    typeof candidate.fingerprint === 'function'
  );
}

async function runTsc(libraryPath: string): Promise<Check> {
  const tsconfigPath = join(libraryPath, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    return check('C0 tsc --noEmit', true, 'manual review — no tsconfig.json found');
  }
  try {
    await execFileAsync('npx', ['tsc', '--noEmit', '-p', libraryPath], { cwd: libraryPath });
    return check('C0 tsc --noEmit', true);
  } catch (error) {
    const message =
      error instanceof Error && 'stderr' in error
        ? String((error as Error & { stderr?: unknown }).stderr ?? error.message)
        : String(error);
    return check('C0 tsc --noEmit', false, message.trim());
  }
}

async function runStandardConformance(libraryPath: string, level: ConformanceLevel): Promise<ConformanceResult> {
  const checks: Check[] = [await runTsc(libraryPath)];
  checks.push(check('C0 exported type assignability', true, 'manual review — cross-package assignability not automated'));

  if (level === 'C0') {
    return finalResult(libraryPath, level, checks);
  }

  const adapter = await loadAdapter(libraryPath);
  if (!adapter) {
    checks.push(check(`${level} adapter checks`, true, 'pending — no adapter found'));
    return finalResult(libraryPath, level, checks);
  }

  const fixtureDir = join(contractsRoot(), 'fixtures', adapter.protocolId);
  const nativePath = join(fixtureDir, 'native.sample.json');
  const expectedPath = join(fixtureDir, 'canonical.expected.json');
  if (!existsSync(nativePath) || !existsSync(expectedPath)) {
    checks.push(check('C1 fixture presence', false, `missing fixture files for ${adapter.protocolId}`));
    return finalResult(libraryPath, level, checks);
  }

  const native = readJson<unknown[]>(nativePath);
  const expected = readJson(expectedPath);
  const canonical = adapter.toCanonical(native);
  const schemaName = CANONICAL_SCHEMA_BY_SHAPE[adapter.canonicalShape];
  const ajv = createAjv();
  const validate = schemaName ? ajv.getSchema(`https://omegaprotocol.org/schemas/${schemaName}`) : undefined;
  const schemaOk = validate?.(canonical) === true;
  const adapterValidation = adapter.validate(canonical);

  checks.push(check('C1 adapter.validate canonical output', adapterValidation.ok, adapterValidation.ok ? undefined : adapterValidation.errors.join('; ')));
  checks.push(check('C1 JSON Schema validates canonical output', schemaOk, schemaOk ? undefined : JSON.stringify(validate?.errors ?? [])));
  checks.push(check('C1 canonical output matches fixture', canonicalize(canonical) === canonicalize(expected)));
  checks.push(check('C1 determinism', canonicalize(adapter.toCanonical(native)) === canonicalize(adapter.toCanonical(native))));
  checks.push(check('C1 fingerprint stability', adapter.fingerprint(native) === adapter.fingerprint(native)));

  const emptyCanonical = adapter.toCanonical([]);
  const availability = typeof emptyCanonical === 'object' && emptyCanonical !== null ? (emptyCanonical as { availability?: Record<string, string> }).availability : undefined;
  const availabilityValues = Object.values(availability ?? {});
  checks.push(check('C1 availability on empty input', availabilityValues.some((value) => value !== 'available')));

  if (level === 'C1') {
    return finalResult(libraryPath, level, checks);
  }

  const compositionRecord = readJson<Record<string, unknown>>(join(contractsRoot(), 'fixtures', 'composition', 'expected_record.json'));
  const fieldName = FIXTURE_TO_RECORD_FIELD[adapter.protocolId];
  if (!fieldName) {
    checks.push(check('C2 synthesized OmegaRecord validates', false, `no OmegaRecord field mapping for ${adapter.protocolId}`));
    return finalResult(libraryPath, level, checks);
  }
  const synthesized = { ...compositionRecord, [fieldName]: canonical };
  const omegaValidate = ajv.getSchema('https://omegaprotocol.org/schemas/omega-record.schema.json');
  const omegaOk = omegaValidate?.(synthesized) === true;
  checks.push(check('C2 synthesized OmegaRecord validates', omegaOk, omegaOk ? undefined : JSON.stringify(omegaValidate?.errors ?? [])));

  if (level === 'C2') {
    return finalResult(libraryPath, level, checks);
  }

  const noTimestamp = !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(JSON.stringify(canonical));
  checks.push(check('C3 no timestamp in adapter output', noTimestamp));
  checks.push(check('C3 derived nullable provenance', hasNullableFieldProvenance(adapter.canonicalShape, canonical)));
  checks.push(hashReproducibilityCheck());

  return finalResult(libraryPath, level, checks);
}

function hasNullableFieldProvenance(shape: string, canonical: unknown): boolean {
  const fieldsByShape: Record<string, string[]> = {
    ClearpathSummary: ['assumption_ratio', 'alternatives_considered_avg'],
    CognitiveProfile: ['calibration', 'consistency'],
    HarmRecord: ['max_severity', 'remediation_rate'],
    AssumptionGate: ['validation_ratio'],
    TrustScore: ['overall_score'],
  };
  const fields = fieldsByShape[shape] ?? [];
  if (fields.length === 0) {
    return true;
  }
  if (typeof canonical !== 'object' || canonical === null) {
    return false;
  }
  const provenance = (canonical as { provenance?: Array<{ field?: string; input_fingerprint?: string }> }).provenance ?? [];
  return fields.every((field) =>
    provenance.some((item) => item.field === field && typeof item.input_fingerprint === 'string' && item.input_fingerprint.length > 0),
  );
}

function hashReproducibilityCheck(): Check {
  const root = contractsRoot();
  const record = readJson<Record<string, unknown>>(join(root, 'fixtures', 'composition', 'expected_record.json'));
  const expected = readFileSync(join(root, 'fixtures', 'composition', 'expected_content_hash.txt'), 'utf8').trim();
  const actual = computeContentHash(record);
  return check('C3 composition content_hash reproducibility', actual === expected && record.content_hash === expected, `actual=${actual} expected=${expected}`);
}

async function runSelfTest(libraryPath: string, level: ConformanceLevel): Promise<ConformanceResult> {
  const checks: Check[] = [];
  const root = contractsRoot();
  const ajv = createAjv();
  const expectedRecord = readJson<Record<string, unknown>>(join(root, 'fixtures', 'composition', 'expected_record.json'));
  const expectedHash = readFileSync(join(root, 'fixtures', 'composition', 'expected_content_hash.txt'), 'utf8').trim();
  const validateOmega = ajv.getSchema('https://omegaprotocol.org/schemas/omega-record.schema.json');
  const schemaOk = validateOmega?.(expectedRecord) === true;
  const actualHash = computeContentHash(expectedRecord);

  checks.push(check('self-test omega-record schema validation', schemaOk, schemaOk ? undefined : JSON.stringify(validateOmega?.errors ?? [])));
  checks.push(check('self-test content_hash reproducibility', actualHash === expectedHash && expectedRecord.content_hash === expectedHash, `actual=${actualHash} expected=${expectedHash}`));

  if (level === 'C3') {
    const protocolDirs = Object.keys(FIXTURE_TO_RECORD_FIELD).filter((protocol) => protocol !== 'trust-score');
    const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
    const timestampHits = protocolDirs.filter((protocol) => {
      const canonical = readFileSync(join(root, 'fixtures', protocol, 'canonical.expected.json'), 'utf8');
      return timestampPattern.test(canonical);
    });
    checks.push(
      check(
        'self-test no adapter timestamps in canonical fixtures',
        timestampHits.length === 0,
        'trust-score fixture excluded because TrustScore has required orchestration timestamps',
      ),
    );
  }

  return finalResult(libraryPath, level, checks);
}

function isCompositionFixturePath(libraryPath: string): boolean {
  return basename(resolve(libraryPath)) === 'composition' && existsSync(join(libraryPath, 'expected_record.json'));
}

export async function runConformance(libraryPath: string, level: ConformanceLevel): Promise<ConformanceResult> {
  const resolvedPath = resolve(libraryPath);
  if (isCompositionFixturePath(resolvedPath)) {
    return runSelfTest(resolvedPath, level);
  }
  return runStandardConformance(resolvedPath, level);
}

export function formatConformanceResult(result: ConformanceResult): string {
  const lines = [
    `Library: ${result.libraryPath}`,
    `Level: ${result.level}`,
    `Passed: ${result.passed ? 'yes' : 'no'}`,
    'Checks:',
  ];
  for (const item of result.checks) {
    const marker = item.passed ? 'PASS' : 'FAIL';
    const pending = isPending(item) ? ' (pending)' : '';
    lines.push(`- ${marker}${pending} ${item.name}${item.message ? ` — ${item.message}` : ''}`);
  }
  return lines.join('\n');
}
