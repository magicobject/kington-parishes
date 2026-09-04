// Unit tests for src/worker/subscribe.mjs — pure functions plus a mocked
// fetch, no live MailerLite calls, no Cloudflare runtime needed.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmail,
  sanitizeName,
  buildMailerLitePayload,
  subscribeToMailerLite,
  PREVIOUSLY_UNSUBSCRIBED_MESSAGE,
} from '../src/worker/subscribe.mjs';

describe('validateEmail', () => {
  test('accepts a plain address', () => {
    assert.equal(validateEmail('person@example.com'), 'person@example.com');
  });

  test('trims surrounding whitespace', () => {
    assert.equal(validateEmail('  person@example.com  '), 'person@example.com');
  });

  test('rejects missing @', () => {
    assert.equal(validateEmail('not-an-email'), null);
  });

  test('rejects empty string', () => {
    assert.equal(validateEmail(''), null);
  });

  test('rejects non-string input', () => {
    assert.equal(validateEmail(undefined), null);
    assert.equal(validateEmail(123), null);
  });

  test('rejects an absurdly long address', () => {
    assert.equal(validateEmail(`${'a'.repeat(250)}@example.com`), null);
  });
});

describe('sanitizeName', () => {
  test('trims whitespace', () => {
    assert.equal(sanitizeName('  Sally  '), 'Sally');
  });

  test('returns undefined for empty or missing input', () => {
    assert.equal(sanitizeName(''), undefined);
    assert.equal(sanitizeName('   '), undefined);
    assert.equal(sanitizeName(undefined), undefined);
  });

  test('caps overly long input', () => {
    assert.equal(sanitizeName('a'.repeat(200)).length, 100);
  });
});

describe('buildMailerLitePayload', () => {
  test('omits fields when no name given', () => {
    assert.deepEqual(buildMailerLitePayload('person@example.com', 'group-1'), {
      email: 'person@example.com',
      groups: ['group-1'],
    });
  });

  test('includes name under fields when given', () => {
    assert.deepEqual(buildMailerLitePayload('person@example.com', 'group-1', 'Sally'), {
      email: 'person@example.com',
      groups: ['group-1'],
      fields: { name: 'Sally' },
    });
  });
});

describe('subscribeToMailerLite', () => {
  const env = { MAILERLITE_API_KEY: 'test-key', MAILERLITE_GROUP_ID: 'group-1' };

  test('returns ok on a successful API response', async () => {
    const fetchMock = async (url, init) => {
      assert.equal(url, 'https://connect.mailerlite.com/api/subscribers');
      assert.equal(init.headers.Authorization, 'Bearer test-key');
      return new Response(null, { status: 200 });
    };

    const result = await subscribeToMailerLite('person@example.com', undefined, env, fetchMock);
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
  });

  test('maps a plain 422 to a friendly validation message', async () => {
    const fetchMock = async () => new Response(null, { status: 422 });
    const result = await subscribeToMailerLite('person@example.com', undefined, env, fetchMock);
    assert.equal(result.ok, false);
    assert.equal(result.status, 422);
    assert.equal(result.message, 'Please enter a valid email address.');
  });

  // Real MailerLite response body for this case, captured while diagnosing
  // a report of a genuinely valid address being told it was "invalid" — a
  // 422 there doesn't necessarily mean a bad email format.
  test('maps a "previously unsubscribed" 422 to its own distinct message, not "invalid email"', async () => {
    const fetchMock = async () =>
      new Response(
        JSON.stringify({
          message: 'The given data was invalid.',
          errors: { email: ['This subscriber is unsubscribed and cannot be imported'] },
          subscriber: '197606381721748792',
        }),
        { status: 422 },
      );
    const result = await subscribeToMailerLite('greg@gregwright.it', undefined, env, fetchMock);
    assert.equal(result.ok, false);
    assert.equal(result.status, 409);
    assert.equal(result.message, PREVIOUSLY_UNSUBSCRIBED_MESSAGE);
  });

  test('maps any other failure to a generic retry message', async () => {
    const fetchMock = async () => new Response(null, { status: 500 });
    const result = await subscribeToMailerLite('person@example.com', undefined, env, fetchMock);
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
  });
});
