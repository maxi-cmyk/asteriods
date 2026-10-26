import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// index.html is a template: each `<!-- @include html/name.html -->` line is replaced by that
// partial, so every screen's markup lives in its own file under web/html/.
export function assembleHtml(file = resolve(root, 'index.html')) {
    return readFileSync(file, 'utf8').replace(
        /^[ \t]*<!-- @include (\S+) -->\n/gm,
        (_, name) => readFileSync(resolve(root, name), 'utf8'),
    );
}
