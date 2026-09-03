// Unit tests for src/worker/index.mjs's routing and honeypot handling.
// worker.fetch is a real Cloudflare export default { fetch(request, env) },
// callable directly with plain Request/Response and a fake env — no
// Cloudflare runtime needed. Only the "valid signup" path reaches
// subscribeToMailerLite, so only that one stubs globalThis.fetch.
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker/index.mjs';

const env = {
  MAILERLITE_API_KEY: 'test-key',
  MAILERLITE_GROUP_ID: 'group-1',
  ASSETS: { fetch: async () => new Response('static page', { status: 200 }) },
};

function post(body) {
  return new Request('https://example.test/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('worker routing', () => {
  test('non-/api/subscribe requests fall through to ASSETS', async () => {
    const response = await worker.fetch(new Request('https://example.test/index.html'), env);
    assert.equal(await response.text(), 'static page');
  });

  test('GET to /api/subscribe falls through to ASSETS, not the handler', async () => {
    const response = await worker.fetch(new Request('https://example.test/api/subscribe'), env);
    assert.equal(await response.text(), 'static page');
  });
});

describe('handleSubscribe', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('malformed JSON returns 400', async () => {
    const request = new Request('https://example.test/api/subscribe', { method: 'POST', body: 'not json' });
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 400);
  });

  test('invalid email returns 422 without calling MailerLite', async () => {
    globalThis.fetch = async () => { throw new Error('should not be called'); };
    const response = await worker.fetch(post({ email: 'not-an-email' }), env);
    assert.equal(response.status, 422);
  });

  test('a filled honeypot field returns success without calling MailerLite', async () => {
    globalThis.fetch = async () => { throw new Error('should not be called'); };
    const response = await worker.fetch(post({ email: 'person@example.com', website: 'http://spam.example' }), env);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
  });

  test('an empty honeypot field is treated as a real submission', async () => {
    globalThis.fetch = async () => new Response(null, { status: 200 });
    const response = await worker.fetch(post({ email: 'person@example.com', website: '' }), env);
    assert.equal(response.status, 200);
  });

  test('a valid signup reaches MailerLite and returns success', async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://connect.mailerlite.com/api/subscribers');
      assert.equal(JSON.parse(init.body).email, 'person@example.com');
      return new Response(null, { status: 200 });
    };
    const response = await worker.fetch(post({ email: 'person@example.com', name: 'Sally' }), env);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
  });
});
