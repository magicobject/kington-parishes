// Runs the real-WebKit iPhone specs (test/iphone.spec.ts) inside Playwright's
// official Linux image, for machines where WebKit cannot run natively. On this
// project's Windows laptop, Smart App Control blocks Playwright's unsigned
// WebKit DLLs (error 4551), and Defender exclusions do not apply to it.
//
// It copies the repo (without node_modules/.git) into the container, installs
// the locked dependencies there, and runs the specs, so nothing Windows-built
// is reused and nothing in your checkout changes. CI runs these specs natively.
// Needs Docker running. The image tag follows the installed @playwright/test.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'node_modules/@playwright/test/package.json'), 'utf8'));
const image = `mcr.microsoft.com/playwright:v${version}-noble`;

const inside = [
  'set -e',
  'mkdir /work',
  'cd /src',
  "tar --exclude=./node_modules --exclude=./.git --exclude=./.claude --exclude=./test-results -cf - . | tar -xf - -C /work",
  'cd /work',
  'npm ci --ignore-scripts --no-audit --no-fund --loglevel=error',
  'npx playwright test test/iphone.spec.ts "$@"',
].join('\n');

const result = spawnSync(
  'docker',
  ['run', '--rm', '--ipc=host', '-v', `${root}:/src:ro`, image, 'bash', '-c', inside, 'bash', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
