import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, mkdirSync, copyFileSync, readFileSync, cpSync } from 'node:fs';
const root = dirname(fileURLToPath(import.meta.url));
const test = process.argv.includes('--test');
const oled = process.argv.includes('--oled');
const outputName = oled ? (test ? 'oled-test' : 'oled') : (test ? 'test' : 'game');
const clang = process.env.CLANGXX || ['/opt/homebrew/opt/llvm/bin/clang++', '/opt/homebrew/opt/llvm@22/bin/clang++'].find(existsSync) || 'clang++';
const linker = process.env.WASM_LD || (existsSync('/opt/homebrew/opt/lld/bin/wasm-ld') ? '/opt/homebrew/opt/lld/bin/wasm-ld' : 'wasm-ld');
if ((clang.includes('/') && !existsSync(clang)) || (linker.includes('/') && !existsSync(linker))) {
  throw new Error('Set CLANGXX and WASM_LD, or install LLVM and lld (brew install llvm lld).');
}
mkdirSync(resolve(root, 'dist'), { recursive: true });
const exports = ['__wasm_call_ctors', 'web_init', 'web_fire_press', 'web_fire_diagnostics', 'web_step', 'web_pixels', 'web_offset', 'web_state', 'web_snapshot', 'web_scene', 'web_width', 'web_height', 'web_actions', 'web_start', 'web_demo', 'web_menu', 'web_practice_targets', 'web_practice_multishot', 'web_practice_double_fire', 'web_stats'];
if (test) exports.push('web_scenario', 'web_test_overlap', 'web_test_pickup');
const args = ['--target=wasm32', '-std=c++17', '-O2', '-nostdlib', '-ffreestanding',
  '-fno-exceptions', '-fno-rtti', '-fno-threadsafe-statics', '-fno-builtin',
  `-I${root}/native`, `-I${root}/../include`, 
  '-Wl,--no-entry', '-Wl,--export-memory', '-Wl,--initial-memory=262144',
  '-Wl,--allow-undefined', ...exports.map(name => `-Wl,--export=${name}`),
  ...(test ? ['-DWEB_TEST'] : []), ...(!oled ? ['-DWEB_HD'] : []),
  `${root}/native/bridge.cpp`, `${root}/native/raster.cpp`,
  `${root}/vendor/gfx-primitives.cpp`, `${root}/../src/display.cpp`,
  `${root}/../src/sound.cpp`, '-o', `${root}/dist/${outputName}.wasm`];
const result = spawnSync(clang, args, { stdio: 'inherit', env: { ...process.env, PATH: `${dirname(linker)}:${process.env.PATH}` } });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
const output = resolve(root, 'dist', `${outputName}.wasm`);
const allowedImports = new Set(['sinf', 'cosf', 'browser_random',
  'browser_tone', 'browser_storage_read', 'browser_storage_write']);
for (const item of WebAssembly.Module.imports(new WebAssembly.Module(readFileSync(output)))) {
  if (item.module !== 'env' || !allowedImports.has(item.name)) {
    throw new Error(`Unexpected WASM import: ${item.module}.${item.name}`);
  }
}
if (!test && !oled) {
  for (const file of ['index.html', 'style.css', 'shell.css', 'app.mjs', 'runtime.mjs', 'records.mjs', 'navigation.mjs', 'controls.mjs', 'calibration.mjs', 'renderer.mjs', 'settings.mjs', 'audio.mjs', 'assets.html', 'gallery.mjs']) {
    if (existsSync(resolve(root, file))) copyFileSync(resolve(root, file), resolve(root, 'dist', file));
  }
  mkdirSync(resolve(root, 'dist/demo'), {recursive:true});
  copyFileSync(resolve(root, 'demo/engine.mjs'), resolve(root, 'dist/demo/engine.mjs'));
  cpSync(resolve(root, 'assets'), resolve(root, 'dist/assets'), { recursive: true });
  copyFileSync(resolve(root, 'vendor/LICENSE.txt'), resolve(root, 'dist/THIRD-PARTY-LICENSE.txt'));
}
console.log(`Built ${outputName}.wasm from production C++ sources.`);
