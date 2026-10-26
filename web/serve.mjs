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
        response.writeHead(200, {
            'Content-Type': types[extname(file)] || 'application/octet-stream',
            'Cache-Control': 'no-store',
        });
        response.end(bytes);
    } catch {
        response.writeHead(404).end('Not found');
    }
}).listen(port, '127.0.0.1', () => console.log(`Asteroids: http://127.0.0.1:${port}`));
