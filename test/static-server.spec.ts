import { test, expect } from './support/fixtures';

// Regression guard: test/support/static-server.ts once resolved request
// paths with a POSIX-only "../" string strip, which a Windows-style or
// URL-encoded backslash traversal ("..\\", "..%5c") could walk straight
// past — path.join/resolve treat backslash as a separator on Windows even
// though the sanitiser didn't. Checks the fix (validate the fully resolved
// path stays inside public/, rather than trying to sanitise the input)
// actually holds, on the platform this repo is developed on.
test('the static test server refuses to serve files outside public/, however the traversal is encoded', async ({
  request,
}) => {
  const attempts = [
    '/../../../../../../Windows/win.ini',
    '/..%5c..%5c..%5c..%5c..%5cWindows%5cwin.ini',
    '/..%2f..%2f..%2f..%2f..%2fWindows%2fwin.ini',
  ];
  for (const path of attempts) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), `expected ${path} to be refused`).toBe(404);
  }
});

test('a normal asset request still serves correctly (sanity check for the test above)', async ({ request }) => {
  const response = await request.get('/css/style.css');
  expect(response.status()).toBe(200);
});
