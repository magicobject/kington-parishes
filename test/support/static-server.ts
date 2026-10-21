// Minimal static file server that mirrors the Cloudflare Workers assets
// behaviour configured in wrangler.jsonc: serve an exact-path file when one
// exists, otherwise respond with public/404.html and a 404 status
// (assets.not_found_handling = "404-page"), and — like Cloudflare's assets
// handler — answer a clean path ("/contact") with that page's "contact.html".
// Unlike Cloudflare it does not redirect "/contact.html" to "/contact": both
// forms get a 200 here, so the specs can still open pages by file name, and
// test/internal-links.spec.ts is what stops the site linking to ".html".
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', 'public');
const PORT = Number(process.env.PORT ?? 4176);

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
};

function decodedUrlPath(urlPath: string): string {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  return decoded === '/' || decoded === '' ? '/index.html' : decoded;
}

// Resolve the request path against ROOT and verify the *fully resolved*
// absolute path is still inside it, rather than trying to sanitise the
// input string first — `path.normalize`/`resolve` follow the current
// platform's separator rules, and on Windows that includes backslash, so a
// POSIX-only string check (stripping literal "../") can be defeated with
// "..\\" or its URL-encoded form ("..%5c") and walk the server out of
// public/ entirely. Checking the resolved output is safe regardless of
// which separator or encoding the traversal attempt used.
function resolveWithinRoot(urlPath: string): string | null {
  const filePath = resolve(join(ROOT, decodedUrlPath(urlPath)));
  return filePath === ROOT || filePath.startsWith(ROOT + sep) ? filePath : null;
}

const server = createServer(async (req, res) => {
  const filePath = resolveWithinRoot(req.url ?? '/');

  try {
    if (!filePath) throw new Error('path escapes public/');
    const body = await readFile(filePath).catch(async (error) => {
      // A clean URL: no file by that name, so try "<name>.html" (still inside ROOT).
      const withHtml = extname(filePath) === '' ? `${filePath}.html` : null;
      if (!withHtml || !withHtml.startsWith(ROOT + sep)) throw error;
      return readFile(withHtml);
    });
    const type = CONTENT_TYPES[extname(filePath)] ?? (extname(filePath) === '' ? CONTENT_TYPES['.html'] : 'application/octet-stream');
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch {
    try {
      const notFoundBody = await readFile(join(ROOT, '404.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(notFoundBody);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  }
});

// Bind to loopback only — this is dev/test tooling standing in for the
// Cloudflare Workers assets handler, not something that should be reachable
// from the rest of the network while `npm test`/`npm run serve` is running.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Static test server serving ${ROOT} at http://localhost:${PORT}`);
});
