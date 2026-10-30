import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleHtml } from './tools/assemble-html.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const directory = resolve(root, 'dist');
// Browser source is served straight from the working tree, so an edit shows on refresh. Only the
// compiled WASM (and its generated files) still come from dist/, via `npm run build`.
const LIVE_DIRS = ['src', 'styles', 'assets', 'dev'].map((name) => resolve(root, name) + sep);
const LIVE_FILES = ['style.css', 'theme.css'].map((name) => resolve(root, name));
const inside = (file, base) => file.startsWith(base);
// Where a request is read from: the page is assembled on demand, the rest is a file on disk.
function locate(path) {
    if (path === '/' || path === '/index.html') return { page: true };
    const live = resolve(root, '.' + path);
    if (LIVE_DIRS.some((base) => inside(live, base)) || LIVE_FILES.includes(live))
        return { file: live };
    // The dev pages sit at the site root; their sources live in dev/.
    const devPage = resolve(root, 'dev', '.' + path);
    if (path.endsWith('.html') && inside(devPage, LIVE_DIRS[3]) && existsSync(devPage))
        return { file: devPage };
    const built = resolve(directory, '.' + path);
    return inside(built, directory + sep) ? { file: built } : null;
}
const port = Number(process.env.PORT || 4173);
const types = {
    '.html': 'text/html; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain',
    '.woff2': 'font/woff2',
    '.png': 'image/png',
    '.json': 'application/json',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
};
createServer(async (request, response) => {
    try {
        const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const found = locate(path);
        if (
            !found ||
            found.file?.endsWith('/test.wasm') ||
            found.file?.endsWith('/oled-test.wasm')
        ) {
            response.writeHead(404).end();
            return;
        }
        const file = found.page ? 'index.html' : found.file;
        const bytes = found.page ? Buffer.from(assembleHtml()) : await readFile(file);
        const headers = {
            'Content-Type': types[extname(file)] || 'application/octet-stream',
            'Cache-Control': 'no-store',
            'Accept-Ranges': 'bytes',
        };
        // Browsers stream the soundtrack with byte ranges (and need them to seek).
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '');
        if (range && (range[1] || range[2])) {
            const start = range[1]
                ? Number(range[1])
                : Math.max(0, bytes.length - Number(range[2]));
            const end =
                range[1] && range[2]
                    ? Math.min(Number(range[2]), bytes.length - 1)
                    : bytes.length - 1;
            if (start > end || start >= bytes.length) {
                response.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` }).end();
                return;
            }
            response.writeHead(206, {
                ...headers,
                'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
                'Content-Length': end - start + 1,
            });
            response.end(bytes.subarray(start, end + 1));
            return;
        }
        response.writeHead(200, headers);
        response.end(bytes);
    } catch {
        response.writeHead(404).end('Not found');
    }
}).listen(port, '127.0.0.1', () => console.log(`Asteroids: http://127.0.0.1:${port}`));
