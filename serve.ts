// Warung Senja v2 — tiny static server for local playtesting (Node stdlib only).
// Serves the repository root so game/ loads at http://localhost:8080/game/index.html
// and main.ts output can be inspected. Not part of the graded entry.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const port = Number(process.env.PORT || 8080);

createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0] === '/' ? '/game/index.html' : req.url.split('?')[0];
    const file = join(here, decodeURIComponent(path));
    if (!file.startsWith(here)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`Warung Senja on http://localhost:${port}/game/index.html`));
