// Unit tests for scripts/vuln-watch-lib.mjs — the pure logic behind the
// daily vulnerability watch (.github/workflows/vuln-watch.yml). No network,
// no npm, no GitHub: sample scanner output in, findings and issue actions out.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  packagesFromLockfile, findingsFromNpmAudit, findingsFromOsv, mergeFindings,
  issueTitle, issueBody, planIssueActions, shouldFail, summaryMarkdown,
} from '../scripts/vuln-watch-lib.mjs';

const lockfile = {
  lockfileVersion: 3,
  packages: {
    '': { name: 'site' },
    'node_modules/tsx': { version: '4.23.12', dev: true },
    'node_modules/node-html-parser': { version: '9.0.4', dev: true },
    'node_modules/hono': { version: '4.1.0' },
    'node_modules/tsx/node_modules/esbuild': { version: '0.25.0', dev: true },
  },
};

const npmAudit = {
  auditReportVersion: 2,
  vulnerabilities: {
    hono: {
      name: 'hono', severity: 'high', isDirect: true,
      via: [{ source: 1101, name: 'hono', title: 'Path traversal in serveStatic', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'high', range: '<4.1.1' }],
      fixAvailable: true,
    },
    esbuild: {
      name: 'esbuild', severity: 'moderate', isDirect: false,
      via: [{ source: 1102, name: 'esbuild', title: 'Dev server allows any website to read responses', url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff', severity: 'moderate', range: '<=0.24.2' }],
      fixAvailable: { name: 'tsx', version: '4.24.0' },
    },
    tsx: { name: 'tsx', severity: 'moderate', isDirect: true, via: ['esbuild'], fixAvailable: true },
  },
};

describe('packagesFromLockfile', () => {
  test('lists every installed package with its version and whether it is dev-only', () => {
    const pkgs = packagesFromLockfile(lockfile);
    assert.deepEqual(pkgs.find((p) => p.name === 'hono'), { name: 'hono', version: '4.1.0', dev: false });
    assert.deepEqual(pkgs.find((p) => p.name === 'esbuild'), { name: 'esbuild', version: '0.25.0', dev: true });
    assert.equal(pkgs.some((p) => p.name === ''), false, 'the root project is not a dependency');
  });
});

describe('findingsFromNpmAudit', () => {
  const findings = findingsFromNpmAudit(npmAudit, packagesFromLockfile(lockfile));

  test('one finding per advisory, keyed by its GHSA id', () => {
    assert.deepEqual(findings.map((f) => f.id).sort(), ['GHSA-aaaa-bbbb-cccc', 'GHSA-dddd-eeee-ffff']);
  });

  test('entries that only point at another package (via: ["esbuild"]) are not separate findings', () => {
    assert.equal(findings.some((f) => f.package === 'tsx'), false);
  });

  test('records severity, the affected range, whether a fix exists, and dev vs production', () => {
    const hono = findings.find((f) => f.package === 'hono');
    assert.equal(hono.severity, 'high');
    assert.equal(hono.range, '<4.1.1');
    assert.equal(hono.fixAvailable, true);
    assert.equal(hono.dev, false);
    assert.equal(findings.find((f) => f.package === 'esbuild').dev, true);
  });
});

describe('findingsFromOsv', () => {
  test('maps OSV vulnerabilities to findings, including malicious-package (MAL-) reports', () => {
    const pkgs = [{ name: 'evil-pkg', version: '1.0.0', dev: true }];
    const findings = findingsFromOsv(pkgs, [[{ id: 'MAL-2026-1', summary: 'Malicious code in evil-pkg', aliases: [] }]]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'MAL-2026-1');
    assert.equal(findings[0].severity, 'critical', 'a malicious package is always treated as critical');
    assert.equal(findings[0].source, 'OSV');
  });
});

describe('mergeFindings', () => {
  test('an OSV report that is an alias of an npm audit advisory is not duplicated', () => {
    const npm = [{ id: 'GHSA-aaaa-bbbb-cccc', package: 'hono', severity: 'high', source: 'npm audit' }];
    const osv = [{ id: 'GHSA-aaaa-bbbb-cccc', package: 'hono', severity: 'unknown', source: 'OSV', aliases: [] },
      { id: 'OSV-2', package: 'hono', severity: 'unknown', source: 'OSV', aliases: ['GHSA-aaaa-bbbb-cccc'] }];
    const merged = mergeFindings(npm, osv);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].severity, 'high', 'the richer npm audit record wins');
  });
});

describe('issue text', () => {
  const finding = { id: 'GHSA-aaaa-bbbb-cccc', package: 'hono', version: '4.1.0', severity: 'high', title: 'Path traversal', range: '<4.1.1', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', dev: false, fixAvailable: true, source: 'npm audit' };

  test('the title carries the advisory id, so the same advisory is recognised tomorrow', () => {
    assert.equal(issueTitle(finding), 'Security advisory: GHSA-aaaa-bbbb-cccc in hono');
  });

  test('the body says in plain words what is affected and what happens next', () => {
    const body = issueBody(finding, '2026-09-27');
    assert.match(body, /production dependency/i);
    assert.match(body, /high/);
    assert.match(body, /<4\.1\.1/);
    assert.match(body, /full test suite/i);
  });
});

describe('planIssueActions', () => {
  const f = (id) => ({ id, package: 'p', severity: 'high' });

  test('opens an issue for a new advisory', () => {
    assert.deepEqual(planIssueActions([f('GHSA-1')], []), [{ action: 'open', finding: f('GHSA-1') }]);
  });

  test('does nothing for an advisory that already has an open issue', () => {
    const existing = [{ number: 4, state: 'OPEN', title: 'Security advisory: GHSA-1 in p' }];
    assert.deepEqual(planIssueActions([f('GHSA-1')], existing), []);
  });

  test('reopens a closed issue if the advisory is still present', () => {
    const existing = [{ number: 4, state: 'CLOSED', title: 'Security advisory: GHSA-1 in p' }];
    assert.deepEqual(planIssueActions([f('GHSA-1')], existing), [{ action: 'reopen', number: 4, finding: f('GHSA-1') }]);
  });

  test('does not mistake GHSA-1 for GHSA-12', () => {
    const existing = [{ number: 9, state: 'OPEN', title: 'Security advisory: GHSA-12 in p' }];
    assert.equal(planIssueActions([f('GHSA-1')], existing).length, 1);
  });
});

describe('shouldFail', () => {
  test('fails the daily run on any high or critical finding, so GitHub emails the owner', () => {
    assert.equal(shouldFail([{ severity: 'moderate' }]), false);
    assert.equal(shouldFail([{ severity: 'moderate' }, { severity: 'high' }]), true);
    assert.equal(shouldFail([{ severity: 'critical' }]), true);
    assert.equal(shouldFail([]), false);
  });
});

describe('summaryMarkdown', () => {
  test('says so plainly when nothing was found', () => {
    assert.match(summaryMarkdown([], 70, '2026-09-27'), /No known vulnerabilities in 70 packages/);
  });

  test('lists each finding with its severity', () => {
    const md = summaryMarkdown([{ id: 'GHSA-1', package: 'hono', severity: 'high', dev: false }], 70, '2026-09-27');
    assert.match(md, /GHSA-1/);
    assert.match(md, /high/);
  });
});
