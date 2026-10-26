// Guards CSS refactors: records the computed style of every element on the page (all screens
// are in the DOM, hidden or not) and compares it after a change.
//
//   const sig = await import('/dev/style-signature.mjs');
//   sig.record('desktop');           // before the change, stored in localStorage
//   ...edit CSS, rebuild, reload...
//   sig.compare('desktop');          // { same: true } or the first differences
//
// Run at each viewport you care about (resize the window between runs; the key names it).
const PROPS = [
    'display',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'z-index',
    'float',
    'width',
    'height',
    'min-width',
    'min-height',
    'max-width',
    'max-height',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'border-top-style',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'border-radius',
    'box-sizing',
    'box-shadow',
    'outline-style',
    'background-color',
    'background-image',
    'background-size',
    'background-position',
    'color',
    'opacity',
    'visibility',
    'overflow-x',
    'overflow-y',
    'transform',
    'filter',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'line-height',
    'letter-spacing',
    'text-align',
    'text-transform',
    'text-shadow',
    'text-decoration-line',
    'white-space',
    'flex-direction',
    'flex-wrap',
    'flex-grow',
    'flex-shrink',
    'flex-basis',
    'order',
    'align-items',
    'align-self',
    'justify-content',
    'gap',
    'grid-template-columns',
    'grid-template-rows',
    'grid-column-start',
    'grid-row-start',
    'cursor',
    'pointer-events',
    'image-rendering',
    'transition-duration',
    'animation-name',
    'content',
    'inset',
];

function describe(el) {
    const id = el.id ? `#${el.id}` : '';
    const cls = el.classList.length ? `.${[...el.classList].join('.')}` : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
}
// Transitions would make a sample depend on timing.
function freeze() {
    if (document.getElementById('signature-freeze')) return;
    const style = document.createElement('style');
    style.id = 'signature-freeze';
    style.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.append(style);
}
function signature() {
    freeze();
    const out = [];
    const all = document.body.querySelectorAll('*');
    for (const el of all) {
        const style = getComputedStyle(el);
        out.push([describe(el), PROPS.map((p) => style.getPropertyValue(p)).join('|')]);
        for (const pseudo of ['::before', '::after']) {
            const content = getComputedStyle(el, pseudo).content;
            if (content && content !== 'none' && content !== 'normal')
                out.push([
                    `${describe(el)}${pseudo}`,
                    PROPS.map((p) => getComputedStyle(el, pseudo).getPropertyValue(p)).join('|'),
                ]);
        }
    }
    return out;
}
const key = (name) => `css-signature:${name}`;

export function record(name) {
    const sig = signature();
    localStorage.setItem(key(name), JSON.stringify(sig));
    return { recorded: sig.length };
}
export function compare(name, limit = 12) {
    const before = JSON.parse(localStorage.getItem(key(name)) || 'null');
    if (!before) return { error: 'nothing recorded for ' + name };
    const after = signature();
    const diffs = [];
    const count = Math.max(before.length, after.length);
    for (let i = 0; i < count; i++) {
        const [a, b] = [before[i], after[i]];
        if (!a || !b || a[0] !== b[0]) {
            diffs.push(`element ${i}: ${a?.[0]} vs ${b?.[0]}`);
        } else if (a[1] !== b[1]) {
            const x = a[1].split('|'),
                y = b[1].split('|');
            const props = PROPS.filter((_, p) => x[p] !== y[p]).map(
                (p) => `${p}: ${x[PROPS.indexOf(p)]} -> ${y[PROPS.indexOf(p)]}`,
            );
            diffs.push(`${a[0]}: ${props.join('; ')}`);
        }
        if (diffs.length >= limit) break;
    }
    return diffs.length
        ? { same: false, elements: after.length, diffs }
        : { same: true, elements: after.length };
}

// Walks every menu screen, then a practice flight and its pause menu, recording or comparing
// each under `${name}:${screen}`. `mode` is 'record' or 'compare'.
export async function walk(name, mode = 'compare') {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const result = {};
    const visit = async (label) => {
        await wait(700);
        // The help screen fills its device line on the first frame it is shown.
        for (
            let i = 0;
            i < 20 && label === 'help' && !document.getElementById('helpDevice').textContent;
            i++
        )
            await wait(100);
        result[label] =
            mode === 'record' ? record(`${name}:${label}`) : compare(`${name}:${label}`);
    };
    for (const screen of ['home', 'mode', 'hangar', 'records', 'settings', 'help', 'lobby']) {
        location.hash = `#${screen}`;
        await visit(screen);
    }
    location.hash = '#home';
    await wait(500);
    document.getElementById('practice').click();
    await visit('practice');
    (document.activeElement || document.body).dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }),
    );
    await visit('pause');
    return result;
}
