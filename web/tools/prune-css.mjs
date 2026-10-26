// Removes CSS declarations that a later rule with the *same selector in the same at-rule
// context* overrides. Such a declaration can never apply (equal specificity, later wins),
// so deleting it cannot change what any element looks like. `!important` is respected.
// Usage: node tools/prune-css.mjs [--write]   (prints a report; --write edits the files)
import { readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';

const order = [
    'styles/shared.css',
    'styles/screens.css',
    'styles/shell.css',
    ...[
        'base', 'panels', 'playfield', 'hud', 'home', 'hangar', 'settings', 'refinements',
        'pause', 'playfield-fit', 'practice', 'results', 'boss', 'records',
    ].map((name) => `styles/theme/${name}.css`),
];
const write = process.argv.includes('--write');
const roots = order.map((file) => ({ file, root: postcss.parse(readFileSync(file, 'utf8')) }));

const context = (node) => {
    const chain = [];
    for (let p = node.parent; p && p.type !== 'root'; p = p.parent)
        chain.unshift(`@${p.name} ${p.params}`);
    return chain.join(' > ');
};
const skip = (rule) => {
    for (let p = rule.parent; p && p.type !== 'root'; p = p.parent)
        if (/keyframes|font-face|property/.test(p.name)) return true;
    return false;
};
const selectorKey = (rule) => rule.selector.replace(/\s+/g, ' ').trim();

// Pass 1: every declaration in cascade order, grouped by (context, selector, property).
const groups = new Map();
for (const { file, root } of roots)
    root.walkRules((rule) => {
        if (skip(rule)) return;
        for (const decl of rule.nodes) {
            if (decl.type !== 'decl') continue;
            const key = `${context(rule)}\u0000${selectorKey(rule)}\u0000${decl.prop}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ file, rule, decl });
        }
    });

// Pass 2: an earlier declaration is dead when a later one, in a different rule, replaces it.
let removed = 0;
const perFile = new Map();
for (const list of groups.values()) {
    for (let i = 0; i < list.length - 1; i++) {
        const early = list[i];
        const later = list.slice(i + 1).find((other) => other.rule !== early.rule);
        if (!later) continue;
        if (early.decl.important && !later.decl.important) continue;
        removed++;
        if (process.argv.includes('--explain') && /dvh|svh|lvh|clamp\(|min\(|max\(|env\(|color-mix|oklch|aspect-ratio|var\(|calc\(/.test(later.decl.value))
            console.log(`${early.file}: ${early.decl.prop}: ${early.decl.value}  ->  ${later.decl.value}  (${later.file})`);
        perFile.set(early.file, (perFile.get(early.file) || 0) + 1);
        early.dead = true;
    }
}
for (const list of groups.values())
    for (const entry of list) if (entry.dead) entry.decl.remove();
// Drop rules left empty (and at-rules left empty).
for (const { root } of roots) {
    let again = true;
    while (again) {
        again = false;
        root.walk((node) => {
            if ((node.type === 'rule' || node.type === 'atrule') && node.nodes && node.nodes.length === 0 && node.name !== 'font-face') {
                node.remove();
                again = true;
            }
        });
    }
}
console.log(`dead declarations: ${removed}`);
for (const [file, n] of perFile) console.log(`  ${file}: ${n}`);
if (write) for (const { file, root } of roots) writeFileSync(file, root.toString());
