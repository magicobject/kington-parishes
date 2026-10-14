// For the browser test of the LAUNCHED site (test/search.spec.ts): `node scripts/advent-launched-copy.mjs make` makes a temporary
// copy of the repository with the three launch flags flipped, the guards deleted and the after-launch wording applied
// (scripts/advent-launch-steps.mjs), builds it there, and prints {"temp": ..., "publicDir": ...} as JSON. `remove <temp>`
// deletes a folder this script made (and refuses anything else). The real repository is never written to.
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeLaunchedCopy, removeTemp } from './advent-launch-steps.mjs';

const [command, argument] = process.argv.slice(2);
if (command === 'make') {
  const { temp, copy } = makeLaunchedCopy();
  const build = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: copy, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (build.status !== 0) {
    removeTemp(temp);
    console.error(build.stdout.split('\n').slice(-8).join('\n'), build.stderr);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({ temp, publicDir: join(copy, 'public') }));
} else if (command === 'remove' && argument) {
  removeTemp(argument);
} else {
  console.error('usage: node scripts/advent-launched-copy.mjs make | remove <temp folder>');
  process.exit(2);
}
