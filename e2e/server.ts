import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

/** Serves a build at `base`. `root` may be a function, read on every request: a test can switch to another build the way a
 * publish does. */
export async function startServer(root: string | (() => string), base = '/mushrooms/') {
  const sockets = new Set<Socket>();
  const server: Server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (!path.startsWith(base)) { res.writeHead(404).end(); return; }
    let rel = normalize(path.slice(base.length)).replace(/^(\.\.[/\\])+/, '');
    if (rel === '' || rel === '.' || rel.endsWith('/')) rel = join(rel, 'index.html');
    try {
      const body = await readFile(join(typeof root === 'function' ? root() : root, rel));
      res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };
  let stopped = false;
  return {
    url: `http://127.0.0.1:${port}${base}`,
    stop: () => new Promise<void>((resolve) => {
      if (stopped) return resolve();
      stopped = true;
      for (const s of sockets) s.destroy();
      server.close(() => resolve());
    }),
  };
}
