#!/usr/bin/env node
// The daily vulnerability watch. Run by .github/workflows/vuln-watch.yml
// every morning (and on demand); run locally with `--dry-run` to see what it
// would do without touching GitHub.
//
// 1. Lists every installed package from package-lock.json.
// 2. Checks them against the GitHub Advisory Database (`npm audit`) and OSV
//    (osv.dev — which also carries reports of malicious packages).
// 3. Opens one `security-advisory` issue per advisory (reopening it if an
//    advisory comes back), and writes a summary for the run page.
// 4. Exits non-zero on any high/critical finding, so GitHub emails the owner.
//
// The decisions are all in scripts/vuln-watch-lib.mjs (unit-tested); this
// file only does the I/O. It never changes code or dependencies itself —
// fixing is a separate, reviewed step.

import { readFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  packagesFromLockfile, findingsFromNpmAudit, findingsFromOsv, mergeFindings,
  issueTitle, issueBody, planIssueActions, shouldFail, summaryMarkdown,
} from './vuln-watch-lib.mjs';

const dryRun = process.argv.includes('--dry-run');
const today = new Date().toISOString().slice(0, 10);
const LABEL = 'security-advisory';

// Never through a shell: issue titles and bodies contain text from outside
// advisories, and a shell would let crafted text run commands. The one
// exception is npm on Windows (npm.cmd needs cmd.exe), called with fixed
// arguments only.
function run(cmd, args, { allowFail = false, shell = false } = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell, maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0 && !allowFail) throw new Error(`${cmd} ${args.join(' ')} failed: ${res.stderr || res.stdout}`);
  return res.stdout;
}

async function queryOsv(packages) {
  const results = [];
  for (let i = 0; i < packages.length; i += 1000) {
    const batch = packages.slice(i, i + 1000);
    const res = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries: batch.map((p) => ({ package: { name: p.name, ecosystem: 'npm' }, version: p.version })) }),
    });
    if (!res.ok) throw new Error(`OSV querybatch failed: HTTP ${res.status}`);
    const { results: batchResults } = await res.json();
    results.push(...batchResults.map((r) => r.vulns ?? []));
  }
  // The batch endpoint returns ids only; fetch each vulnerability's details.
  const details = new Map();
  for (const id of new Set(results.flat().map((v) => v.id))) {
    const res = await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`);
    if (res.ok) details.set(id, await res.json());
  }
  return results.map((vulns) => vulns.map((v) => details.get(v.id) ?? v));
}

const packages = packagesFromLockfile(JSON.parse(readFileSync('package-lock.json', 'utf8')));
// npm audit exits non-zero when it finds something — that's data, not an error.
const audit = JSON.parse(run('npm', ['audit', '--json'], { allowFail: true, shell: process.platform === 'win32' }) || '{}');
const findings = mergeFindings(
  findingsFromNpmAudit(audit, packages),
  findingsFromOsv(packages, await queryOsv(packages)),
);

const summary = summaryMarkdown(findings, packages.length, today);
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

if (dryRun) {
  console.log('(dry run: no GitHub issues opened or reopened)');
} else if (findings.length) {
  run('gh', ['label', 'create', LABEL, '--color', 'B60205', '--description', 'Opened by the daily vulnerability watch', '--force']);
  const existing = JSON.parse(run('gh', ['issue', 'list', '--label', LABEL, '--state', 'all', '--limit', '500', '--json', 'number,state,title']));
  for (const step of planIssueActions(findings, existing)) {
    if (step.action === 'open') {
      run('gh', ['issue', 'create', '--title', issueTitle(step.finding), '--body', issueBody(step.finding, today), '--label', LABEL]);
      console.log(`opened: ${issueTitle(step.finding)}`);
    } else {
      run('gh', ['issue', 'reopen', String(step.number), '--comment', `Still present on ${today} — reopened by the daily vulnerability watch.`]);
      console.log(`reopened #${step.number}: ${issueTitle(step.finding)}`);
    }
  }
}

process.exitCode = shouldFail(findings) ? 1 : 0;
