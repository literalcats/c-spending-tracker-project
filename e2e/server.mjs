/* =====================================================================
   e2e/server.mjs — a tiny local web server for development and tests.
   It serves this folder AND applies the same headers as Vercel
   (read from vercel.json: Content-Security-Policy, no-cache for sw.js...).
   So tests run under the real security policy, and `npm start` shows
   you what visitors will get.
   Run:  npm start   → http://localhost:4173
   ===================================================================== */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

// Turn vercel.json "headers" rules into { pattern, headers } (supports "/(.*)" and exact paths).
const config = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));
const rules = (config.headers || []).map((r) => ({
  pattern: new RegExp('^' + r.source.replace('(.*)', '.*') + '$'),
  headers: r.headers,
}));

http.createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(ROOT, '.' + (path.endsWith('/') ? path + 'index.html' : path));
  const hidden = path.split('/').some((part) => part.startsWith('.') || part === 'node_modules');
  if (!file.startsWith(ROOT + sep) || hidden) { res.writeHead(404).end('Not found'); return; } // no path tricks, no secrets
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate'); // Vercel's default for static files
    for (const rule of rules) if (rule.pattern.test(path)) for (const h of rule.headers) res.setHeader(h.key, h.value);
    res.writeHead(200).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Spending Tracker running at http://localhost:${PORT}`));
