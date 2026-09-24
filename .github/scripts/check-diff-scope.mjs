#!/usr/bin/env node
// Standalone, dependency-free copy of siteadmin's scope-check logic, for
// distribution into managed repos alongside the Action workflow template —
// copied to .github/scripts/check-diff-scope.mjs at onboarding (Phase 6),
// same "no sync mechanism yet, re-copy by hand" situation as the workflow
// YAML itself. Canonical source: src/scope-check.ts + scripts/check-diff-scope.ts
// in siteadmin — keep this file's logic in sync with those by hand.
//
// No dependency on minimatch (deliberately) — a managed repo shouldn't need
// a new devDependency just for this CI step. The glob vocabulary this
// project actually authors in capability_scopes.jsonl is simple (literal
// paths, "*" within one path segment, "**" across segments), so a small
// hand-rolled matcher is enough — and it has no "dot" quirk to work around
// (see src/scope-check.ts's dot:true comment): "**" here just means
// "anything," including .github, by construction.
//
// Reads the FULL unified diff (not just paths) from stdin — changed paths
// are derived from the diff's own headers, so the path-scope check and the
// script-injection scan below can never silently drift out of sync.

function globToRegExp(glob) {
	let pattern = '';
	for (let i = 0; i < glob.length; i++) {
		const c = glob[i];
		if (c === '*' && glob[i + 1] === '*') {
			pattern += '.*';
			i++;
		} else if (c === '*') {
			pattern += '[^/]*';
		} else if ('.+^${}()|[]\\'.includes(c)) {
			pattern += '\\' + c;
		} else {
			pattern += c;
		}
	}
	return new RegExp(`^${pattern}$`);
}

function matchesGlob(path, glob) {
	return globToRegExp(glob).test(path);
}

const INFRA_EXCLUSION_GLOBS = ['.github/**', 'wrangler.toml', 'wrangler.jsonc', 'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

function touchesExcludedPath(paths) {
	return paths.some((p) => INFRA_EXCLUSION_GLOBS.some((g) => matchesGlob(p, g)));
}

function allPathsInScope(paths, globs) {
	return paths.every((p) => globs.some((g) => matchesGlob(p, g)));
}

// A mechanical, content-based gate alongside the path-based scope check —
// never a hard block on its own, just forces a human look (same "held for
// review" treatment as an out-of-scope or infra-excluded path). A false
// positive (a legitimate <iframe> embed, a genuinely-needed inline
// handler) costs one manual review, not a silently dropped or broken
// change.
const SCRIPT_INJECTION_PATTERNS = [
	{ label: '<script> tag', pattern: /<script[\s>]/i },
	{ label: 'javascript: URI', pattern: /javascript:/i },
	// Requires a real "on<name>=" attribute with a quoted value — not just
	// any word ending in "on" immediately before an unrelated "=".
	{ label: 'inline event handler attribute', pattern: /\bon[a-z]+\s*=\s*["']/i },
	{ label: '<iframe> tag', pattern: /<iframe[\s>]/i },
];

function scanAddedLinesForScriptInjection(diffText) {
	const matches = new Set();
	for (const line of diffText.split('\n')) {
		if (!line.startsWith('+') || line.startsWith('+++')) continue;
		const added = line.slice(1);
		for (const { label, pattern } of SCRIPT_INJECTION_PATTERNS) {
			if (pattern.test(added)) matches.add(label);
		}
	}
	return { suspicious: matches.size > 0, matches: [...matches] };
}

function changedPathsFromDiff(diffText) {
	const paths = new Set();
	for (const line of diffText.split('\n')) {
		const match = line.match(/^(?:---|\+\+\+) (?:[ab]\/(.+)|\/dev\/null)$/);
		if (match?.[1]) paths.add(match[1]);
	}
	return [...paths];
}

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
	const globsJson = process.argv[2];
	if (!globsJson) {
		console.error('Usage: check-diff-scope.mjs \'["glob1","glob2"]\' < full-diff.txt');
		process.exit(2);
	}
	const globs = JSON.parse(globsJson);
	const diffText = await readStdin();
	const changedPaths = changedPathsFromDiff(diffText);

	if (changedPaths.length === 0) {
		console.log('No changed files — nothing to check.');
		process.exit(0);
	}

	if (touchesExcludedPath(changedPaths)) {
		const hit = changedPaths.filter((p) => touchesExcludedPath([p]));
		console.error(`HELD FOR REVIEW: touches infrastructure-shaped path(s), never auto-mergeable regardless of capability: ${hit.join(', ')}`);
		process.exit(1);
	}

	if (!allPathsInScope(changedPaths, globs)) {
		const outOfScope = changedPaths.filter((p) => !allPathsInScope([p], globs));
		console.error(`HELD FOR REVIEW: path(s) outside this capability's scope: ${outOfScope.join(', ')}`);
		process.exit(1);
	}

	const scriptCheck = scanAddedLinesForScriptInjection(diffText);
	if (scriptCheck.suspicious) {
		console.error(`HELD FOR REVIEW: added content looks like it could run script in a visitor's browser (${scriptCheck.matches.join(', ')}) — needs a human look, not auto-merge.`);
		process.exit(1);
	}

	console.log('In scope, clear of the infra exclusion list, and no suspicious added markup.');
	process.exit(0);
}

main();
