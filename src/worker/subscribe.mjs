// Talks to the MailerLite API on behalf of the newsletter signup form.
// Kept free of any Cloudflare Workers globals so it's testable under plain
// `node --test` (see test-unit/worker-subscribe.test.mjs) with a mocked fetch.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;

// Returns the trimmed, valid email, or null if the input isn't usable.
export function validateEmail(email) {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) return null;
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}

// Returns the trimmed name (capped to a sane length), or undefined if absent.
export function sanitizeName(name) {
  if (typeof name !== 'string') return undefined;
  const trimmed = name.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

export function buildMailerLitePayload(email, groupId, name) {
  const payload = { email, groups: [groupId] };
  if (name) payload.fields = { name };
  return payload;
}

// MailerLite adds the subscriber and (with double opt-in enabled on the
// group, see Phase 2) sends its own confirmation email automatically —
// nothing else to do here for that part.
export async function subscribeToMailerLite(email, name, env, fetchImpl = fetch) {
  const response = await fetchImpl('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
    },
    body: JSON.stringify(buildMailerLitePayload(email, env.MAILERLITE_GROUP_ID, name)),
  });

  if (response.ok) {
    return { ok: true, status: 200, message: 'Almost there — check your email to confirm your subscription.' };
  }

  if (response.status === 422) {
    return { ok: false, status: 422, message: 'Please enter a valid email address.' };
  }

  // Never logs the request itself (so the API key is never at risk of
  // ending up in Cloudflare's log stream) — only MailerLite's own response,
  // for diagnosing things like an auth failure vs. a misconfigured group id.
  const body = await response.text();
  console.error('MailerLite subscribe failed', response.status, body);
  // TEMPORARY (remove before Phase 3's public form ships): surfacing
  // MailerLite's raw response in the client message so this can be verified
  // live without a round trip through Cloudflare's log dashboard each time.
  return {
    ok: false,
    status: 502,
    message: `Something went wrong on our end (MailerLite responded ${response.status}: ${body}) — please try again shortly.`,
  };
}
