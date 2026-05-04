import { chmodSync, readFileSync, writeFileSync } from 'node:fs';

const cliPath = 'dist/cli.js';
const content = readFileSync(cliPath, 'utf8');

if (!content.startsWith('#!')) {
  writeFileSync(cliPath, '#!/usr/bin/env node\n' + content);
}

chmodSync(cliPath, 0o755);
console.log('postbuild: cli.js shebang and executable bit ensured');
