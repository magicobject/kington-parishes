// Pure logic behind the daily vulnerability watch. Scanner output in,
// findings and GitHub issue actions out — no network, no child processes,
// so all of it is unit-tested (test-unit/vuln-watch.test.mjs). The side
// effects (running npm audit, calling OSV, talking to GitHub) live in
// scripts/vuln-watch.mjs.
//
// A "finding" is { id, package, version, severity, title, range, url, dev,
// fixAvailable, source, aliases }.

const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low', 'info', 'unknown'];

// Every installed package in an npm v2/v3 lockfile, with whether it's only
// needed for development/testing (dev: true) or ships with the project.
export function packagesFromLockfile(lockfile) {
  return Object.entries(lockfile.packages ?? {})
    .filter(([path]) => path.includes('node_modules/'))
    .map(([path, info]) => ({
      name: path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length),
      version: info.version,
      dev: Boolean(info.dev),
    }));
}

function ghsaFromUrl(url) {
  return url?.match(/GHSA(-[a-z0-9]{4}){3}/i)?.[0] ?? null;
}

// `npm audit --json` (auditReportVersion 2) -> findings. An entry whose
// `via` is just the name of another vulnerable package (e.g. tsx -> esbuild)
// isn't its own advisory, so only object-shaped `via` entries count.
export function findingsFromNpmAudit(audit, packages) {
  const byId = new Map();
  for (const vuln of Object.values(audit.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object') continue;
      const id = ghsaFromUrl(via.url) ?? `NPM-${via.source}`;
      if (byId.has(id)) continue;
      const installed = packages.filter((p) => p.name === via.name);
      byId.set(id, {
        id,
        package: via.name,
        version: installed.map((p) => p.version).join(', '),
        severity: via.severity ?? vuln.severity ?? 'unknown',
        title: via.title ?? '',
        range: via.range ?? '',
        url: via.url ?? '',
        dev: installed.length > 0 && installed.every((p) => p.dev),
        fixAvailable: Boolean(vuln.fixAvailable),
        source: 'npm audit',
        aliases: [],
      });
    }
  }
  return [...byId.values()];
}

// OSV querybatch results (one array of vulns per queried package, in the
// same order as `packages`) -> findings. OSV also carries malicious-package
// reports (MAL-...), which npm audit doesn't — those are always critical.
export function findingsFromOsv(packages, vulnsPerPackage) {
  const findings = [];
  vulnsPerPackage.forEach((vulns, i) => {
    const pkg = packages[i];
    for (const v of vulns ?? []) {
      findings.push({
        id: v.id,
        package: pkg.name,
        version: pkg.version,
        severity: v.id.startsWith('MAL-') ? 'critical' : (v.database_specific?.severity ?? 'unknown').toLowerCase(),
        title: v.summary ?? '',
        range: '',
        url: `https://osv.dev/vulnerability/${v.id}`,
        dev: pkg.dev,
        fixAvailable: false,
        source: 'OSV',
        aliases: v.aliases ?? [],
      });
    }
  });
  return findings;
}

// npm audit's records are richer (range, fix), so they win; an OSV report
// is dropped if it's the same advisory under its own id or an alias.
export function mergeFindings(npmFindings, osvFindings) {
  const seen = new Set(npmFindings.map((f) => f.id));
  const merged = [...npmFindings];
  for (const f of osvFindings) {
    if (seen.has(f.id) || f.aliases.some((a) => seen.has(a))) continue;
    seen.add(f.id);
    merged.push(f);
  }
  return merged.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

export function issueTitle(finding) {
  return `Security advisory: ${finding.id} in ${finding.package}`;
}

export function issueBody(finding, date) {
  const kind = finding.dev
    ? 'a **development-only dependency** (used to build and test the site, not sent to visitors — but it runs on build machines, so it still matters)'
    : 'a **production dependency** (part of what actually runs)';
  return [
    `The daily vulnerability watch found a published advisory affecting this repository on ${date}.`,
    '',
    `- **Advisory:** [${finding.id}](${finding.url})${finding.title ? ` — ${finding.title}` : ''}`,
    `- **Package:** \`${finding.package}\` ${finding.version ? `(installed: ${finding.version})` : ''}`,
    `- **Severity:** ${finding.severity}`,
    finding.range ? `- **Affected versions:** \`${finding.range}\`` : null,
    `- **Found by:** ${finding.source}`,
    `- **What it is:** ${kind}`,
    `- **Fix available:** ${finding.fixAvailable ? 'yes' : 'not yet known'}`,
    '',
    '**What happens next:** update the package, run the full test suite and `npm run audit`, and open a PR for review. It is never merged automatically.',
    '',
    '_Opened automatically by `.github/workflows/vuln-watch.yml`. This issue stays open until the advisory no longer applies; the watch reopens it if a closed advisory reappears._',
  ].filter((line) => line !== null).join('\n');
}

// Decide what to do with GitHub, given this run's findings and the existing
// `security-advisory` issues ({ number, state, title }). One issue per
// advisory, ever: new -> open; closed but still present -> reopen; open -> leave.
export function planIssueActions(findings, existingIssues) {
  const actions = [];
  for (const finding of findings) {
    const title = issueTitle(finding);
    const match = existingIssues.find((i) => i.title === title);
    if (!match) actions.push({ action: 'open', finding });
    else if (match.state !== 'OPEN') actions.push({ action: 'reopen', number: match.number, finding });
  }
  return actions;
}

// A failed scheduled run makes GitHub email the repo owner — the real-time
// nudge for anything serious.
export function shouldFail(findings) {
  return findings.some((f) => f.severity === 'high' || f.severity === 'critical');
}

// The run's summary, shown on the workflow run page (GITHUB_STEP_SUMMARY) —
// a daily record even on days when nothing is found.
export function summaryMarkdown(findings, packageCount, date) {
  if (!findings.length) {
    return `## Vulnerability watch — ${date}\n\nNo known vulnerabilities in ${packageCount} packages (checked against the GitHub Advisory Database via npm audit, and OSV).\n`;
  }
  const rows = findings.map((f) => `| ${f.severity} | ${f.id} | \`${f.package}\` | ${f.dev ? 'dev' : 'production'} | ${f.source} |`);
  return [
    `## Vulnerability watch — ${date}`,
    '',
    `${findings.length} advisory(ies) affecting ${packageCount} packages:`,
    '',
    '| Severity | Advisory | Package | Kind | Source |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
