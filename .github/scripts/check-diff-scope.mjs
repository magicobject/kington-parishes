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

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
	const globsJson = process.argv[2];
	if (!globsJson) {
		console.error('Usage: check-diff-scope.mjs \'["glob1","glob2"]\' < changed-paths.txt');
		process.exit(2);
	}
	const globs = JSON.parse(globsJson);
	const changedPaths = (await readStdin())
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

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

	console.log('In scope and clear of the infra exclusion list.');
	process.exit(0);
}

main();
