#!/usr/bin/env node
import { formatConformanceResult, runConformance, type ConformanceLevel } from './conformance.js';

const USAGE = `Usage:
  omega-contracts-conformance <library-path> --level <C0|C1|C2|C3>

Options:
  --level <level>  Conformance level to run. Defaults to C1.
  --help           Show this help message.
`;

function parseArgs(argv: string[]): { libraryPath?: string; level: ConformanceLevel; help: boolean } {
  let libraryPath: string | undefined;
  let level: ConformanceLevel = 'C1';
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--level') {
      const value = argv[index + 1];
      if (value !== 'C0' && value !== 'C1' && value !== 'C2' && value !== 'C3') {
        throw new Error(`Invalid --level value: ${value ?? '<missing>'}`);
      }
      level = value;
      index += 1;
      continue;
    }
    if (!libraryPath) {
      libraryPath = arg;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  return libraryPath === undefined ? { level, help } : { libraryPath, level, help };
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(USAGE);
      return;
    }
    if (!args.libraryPath) {
      console.error(USAGE);
      process.exitCode = 1;
      return;
    }

    const result = await runConformance(args.libraryPath, args.level);
    console.log(formatConformanceResult(result));
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
