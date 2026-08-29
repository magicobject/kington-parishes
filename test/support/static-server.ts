// Minimal static file server that mirrors the Cloudflare Workers assets
// behaviour configured in wrangler.jsonc: serve an exact-path file when one
// exists, otherwise respond with public/404.html and a 404 status
// (assets.not_found_handling = "404-page").
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { normalize as posixNormalize } from 'node:path/posix';

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
};

function resolvePath(urlPath: string): string {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const clean = posixNormalize(decoded).replace(/^(\.\.\/)+/, '');
  return clean === '/' || clean === '' ? '/index.html' : clean;
}

const server = createServer(async (req, res) => {
  const requestPath = resolvePath(req.url ?? '/');
  const filePath = join(ROOT, requestPath);

  try {
    const body = await readFile(filePath);
    const type = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
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

server.listen(PORT, () => {
  console.log(`Static test server serving ${ROOT} at http://localhost:${PORT}`);
});
