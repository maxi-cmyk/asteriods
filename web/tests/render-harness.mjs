// A recording stand-in for the browser's canvas: every drawing call, style change and image
// is folded into a hash, so a refactor of the renderer can be checked for identical output
// without a browser. Import this before any module that touches `document`.
import { readFileSync } from 'node:fs';

let canvasIds = 0;
export const trace = { hash: 0x811c9dc5, calls: 0 };
const mix = (text) => {
    for (let i = 0; i < text.length; i++)
        trace.hash = Math.imul(trace.hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
    trace.calls++;
};
export const resetTrace = () => {
    trace.hash = 0x811c9dc5;
    trace.calls = 0;
};
const dataHash = (data) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) h = Math.imul(h ^ (data[i] & 0xffff), 0x01000193) >>> 0;
    return h.toString(16);
};
const show = (value) => {
    if (typeof value === 'number') return String(Math.round(value * 1000) / 1000);
    if (value === null || value === undefined || typeof value !== 'object') return String(value);
    if (value.__canvas) return `canvas#${value.__canvas}`;
    if (value.__image) return `image:${value.__image}`;
    if (value.data && value.width)
        return `data:${value.width}x${value.height}:${dataHash(value.data)}`;
    if (ArrayBuffer.isView(value)) return `array:${dataHash(value)}`;
    if (Array.isArray(value)) return `[${value.map(show).join(',')}]`;
    return (
        '{' +
        Object.keys(value)
            .sort()
            .map((k) => `${k}:${show(value[k])}`)
            .join(',') +
        '}'
    );
};

class FakeImageData {
    constructor(data, width, height) {
        if (typeof data === 'number')
            [data, width, height] = [new Uint8ClampedArray(data * width * 4), data, width];
        this.data = data;
        this.width = width;
        this.height = height ?? data.length / 4 / width;
    }
}
globalThis.ImageData = FakeImageData;

function makeContext(id, state) {
    const store = {};
    return new Proxy(store, {
        get(target, key) {
            if (key in target) return target[key];
            if (key === 'canvas') return state.canvas;
            if (key === 'measureText') return (text) => ({ width: String(text).length * 6 });
            if (key === 'createImageData') return (w, h) => new FakeImageData(w, h);
            if (key === 'getImageData')
                return (x, y, w, h) => {
                    mix(`${id}.getImageData(${x},${y},${w},${h})`);
                    return new FakeImageData(w, h);
                };
            if (
                key === 'createLinearGradient' ||
                key === 'createRadialGradient' ||
                key === 'createPattern'
            )
                return (...a) => {
                    mix(`${id}.${String(key)}(${a.map(show)})`);
                    return { addColorStop: (o, c) => mix(`stop(${o},${c})`) };
                };
            return (...args) => {
                mix(`${id}.${String(key)}(${args.map(show).join(',')})`);
            };
        },
        set(target, key, value) {
            target[key] = value;
            mix(`${id}.${String(key)}=${show(value)}`);
            return true;
        },
    });
}
export function makeCanvas(width = 300, height = 150) {
    const id = ++canvasIds;
    const state = {};
    const canvas = {
        __canvas: id,
        width,
        height,
        getContext: () => (state.context ??= makeContext(id, state)),
        toDataURL: () => `data:canvas${id}`,
    };
    state.canvas = canvas;
    return canvas;
}
globalThis.document = { createElement: () => makeCanvas() };

// Stand-ins for the loaded art: shapes are real (the sprite and world manifests), pixels are not.
const image = (name, width, height) => ({ __image: name, width, height });
export function fakeArt() {
    const worlds = JSON.parse(readFileSync(new URL('../assets/worlds.json', import.meta.url)));
    const sprites = new Proxy(
        {},
        { get: (_, name) => (typeof name === 'string' ? { x: 1, y: 2, w: 8, h: 8 } : undefined) },
    );
    const bossCalls =
        (name) =>
        (...args) => {
            mix(`boss.${name}(${args.map((a) => (a && a.__canvas ? 'ctx' : show(a))).join(',')})`);
            return true;
        };
    const bossArt = {
        ready: () => true,
        load: bossCalls('load'),
        prepare: bossCalls('prepare'),
        draw: bossCalls('draw'),
        drawFx: bossCalls('drawFx'),
        drawRotated: bossCalls('drawRotated'),
        silhouette: bossCalls('silhouette'),
        icon: bossCalls('icon'),
        rubble: () => [
            { canvas: makeCanvas(30, 30), dx: 10, dy: -5 },
            { canvas: makeCanvas(24, 28), dx: -20, dy: 15 },
        ],
    };
    return {
        atlas: makeCanvas(256, 720),
        font: image('font', 96, 128),
        sprites,
        worlds: { image: image('worlds', 2048, 512), frames: worlds },
        bossArt,
    };
}
