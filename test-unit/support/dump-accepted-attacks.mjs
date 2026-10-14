// Prints, as JSON on stdout, the largest picture of every hostile class that the picture check still accepts, for the browser
// timing spec (test/advent-svg-render.spec.ts runs this with node: a Playwright spec cannot import the ES modules itself).
import { ATTACKS, largestAccepted } from './svg-attacks.mjs';

const accepted = Object.keys(ATTACKS)
  .map((name) => ({ name, found: largestAccepted(name) }))
  .filter(({ found }) => found !== null)
  .map(({ name, found }) => ({ name, n: found.n, weight: found.stats.weight, text: found.text }));
process.stdout.write(JSON.stringify(accepted));
