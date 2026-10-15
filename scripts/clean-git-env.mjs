// Preloaded by `npm run test:unit` (node --import). Git sets GIT_DIR and friends when it runs a hook, so a unit test
// run from the pre-push hook would otherwise have its throwaway repositories (git init, git config, git commit)
// act on the REAL repository, rewriting its config. Clear them before any test starts.
for (const name of Object.keys(process.env)) {
  if (name.startsWith('GIT_')) delete process.env[name];
}
