import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
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
        const file = resolve(directory, '.' + (path === '/' ? '/index.html' : path));
        if (
            !file.startsWith(directory + sep) ||
            file.endsWith('/test.wasm') ||
            file.endsWith('/oled-test.wasm')
        ) {
            response.writeHead(404).end();
            return;
        }
        const bytes = await readFile(file);
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
