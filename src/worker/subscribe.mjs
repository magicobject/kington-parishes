// Talks to the MailerLite API on behalf of the newsletter signup form.
// Kept free of any Cloudflare Workers globals so it's testable under plain
// `node --test` (see test-unit/worker-subscribe.test.mjs) with a mocked fetch.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;

// Double opt-in is currently switched OFF in MailerLite (see CLAUDE.md's
// "Newsletter signup confirmation copy" note) — a happy response here means
// the subscriber is already active, no confirmation email gets sent. Keep
// this message honest about that; if double opt-in is re-enabled later,
// this needs to change back to a "check your email" message, alongside
// every other place CLAUDE.md lists.
export const SUCCESS_MESSAGE = "You're subscribed! Welcome to the InSpire Newsletter.";
export const PREVIOUSLY_UNSUBSCRIBED_MESSAGE = 'This address was previously unsubscribed, so we can’t re-add it automatically. Email vicar@kingtonparishes.org.uk and we’ll add you back by hand.';

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

// With double opt-in enabled on the group, MailerLite would send its own
// confirmation email automatically and this call alone is enough to
// trigger it — but double opt-in is currently off (see the note on
// SUCCESS_MESSAGE above), so a happy response here subscribes the address
// immediately, with no email sent at all.
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
    return { ok: true, status: 200, message: SUCCESS_MESSAGE };
  }

  if (response.status === 422) {
    // A 422 doesn't always mean the email format is bad — MailerLite also
    // uses it when the address was previously unsubscribed and refuses to
    // silently re-add it via the API (a deliberate anti-spam protection on
    // their side, not something to route around). Tell the visitor the real
    // reason rather than the misleading "enter a valid email" for that case.
    const body = await response.json().catch(() => null);
    const emailErrors = body?.errors?.email;
    if (Array.isArray(emailErrors) && emailErrors.some((message) => /unsubscribed/i.test(message))) {
      return { ok: false, status: 409, message: PREVIOUSLY_UNSUBSCRIBED_MESSAGE };
    }
    return { ok: false, status: 422, message: 'Please enter a valid email address.' };
  }

  // Never logs the request itself (so the API key is never at risk of
  // ending up in Cloudflare's log stream) — only MailerLite's own response,
  // for diagnosing things like an auth failure vs. a misconfigured group id.
  console.error('MailerLite subscribe failed', response.status, await response.text());
  return { ok: false, status: 502, message: 'Something went wrong on our end — please try again shortly.' };
}
