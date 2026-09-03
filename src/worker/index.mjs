// Worker entry point. Everything except /api/* falls straight through to
// the static site (env.ASSETS) — this repo is still a static site first,
// with just the newsletter signup endpoint bolted on.
import { validateEmail, sanitizeName, subscribeToMailerLite } from './subscribe.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSubscribe(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: 'Invalid request.' }, 400);
  }

  const email = validateEmail(body?.email);
  if (!email) {
    return jsonResponse({ ok: false, message: 'Please enter a valid email address.' }, 422);
  }

  const name = sanitizeName(body?.name);
  const result = await subscribeToMailerLite(email, name, env);
  return jsonResponse({ ok: result.ok, message: result.message }, result.status);
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
