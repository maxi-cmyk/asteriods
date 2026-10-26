// Keyboard, d-pad and L1/R1 focus movement over whatever menu is on screen.
// `scope()` returns the element whose controls are currently reachable.
function scrollerOf(el) {
    for (let node = el.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);
        if (/(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1)
            return node;
    }
    return document.scrollingElement;
}
function onScreen(el) {
    const box = el.getBoundingClientRect(),
        scroller = scrollerOf(el);
    const clip =
        scroller === document.scrollingElement
            ? { top: 0, bottom: innerHeight }
            : scroller.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    return middle >= Math.max(0, clip.top) && middle <= Math.min(innerHeight, clip.bottom);
}

const FOCUSABLE = 'button,a,input,select';
const reachable = (el) =>
    !el.disabled && !el.hidden && !el.closest('[inert]') && el.getClientRects().length;

export class MenuFocus {
    constructor(scope) {
        this.scope = scope;
    }
    controls() {
        return [...this.scope().querySelectorAll(FOCUSABLE)].filter(reachable);
    }
    move(direction) {
        const nodes = this.controls();
        if (!nodes.length) return;
        const current = nodes.indexOf(document.activeElement);
        nodes[(current + direction + nodes.length) % nodes.length].focus();
    }
    // Moves focus toward the nearest control in a direction, so a grid (the Hangar
    // bay, a pair of mode cards) works with the d-pad as it looks, not as the DOM
    // is ordered. Falls back to wrapping through the list when nothing lies that way.
    moveToward(dx, dy) {
        const nodes = this.controls();
        const current = nodes.indexOf(document.activeElement);
        if (current < 0) {
            nodes[0]?.focus();
            return;
        }
        // From the Settings rail, Right enters the panel at its first control.
        if (dx > 0 && nodes[current].closest('.settings-tabs')) {
            const first = nodes.find((el) => el.closest('[data-settings-panel]'));
            if (first) {
                first.focus();
                return;
            }
        }
        const from = nodes[current].getBoundingClientRect(),
            home = scrollerOf(nodes[current]);
        const fx = from.left + from.width / 2,
            fy = from.top + from.height / 2;
        const options = [];
        for (const [index, node] of nodes.entries()) {
            if (index === current) continue;
            const box = node.getBoundingClientRect();
            const along =
                (box.left + box.width / 2 - fx) * dx + (box.top + box.height / 2 - fy) * dy;
            if (along <= 2) continue;
            const across = Math.abs(
                (box.left + box.width / 2 - fx) * dy + (box.top + box.height / 2 - fy) * dx,
            );
            options.push({
                node,
                rank: along + across * 2.5,
                same: scrollerOf(node) === home,
                shown: onScreen(node),
            });
        }
        const nearest = (list) => list.sort((a, b) => a.rank - b.rank)[0]?.node;
        // Sideways: the nearest visible control, wherever it lives. Up and down: walk
        // the current scrolling area in order (revealing hidden rows) before leaving it.
        const target = dx
            ? nearest(options.filter((o) => o.shown)) || nearest(options)
            : nearest(options.filter((o) => o.same)) ||
              nearest(options.filter((o) => o.shown)) ||
              nearest(options);
        if (target) target.focus();
        else this.move(dx + dy > 0 ? 1 : -1);
    }
    // L1 / R1 step through the active tab strip (Settings categories, Hangar pilots).
    stepTab(direction) {
        const tabs = [
            ...this.scope().querySelectorAll('.settings-tabs button, .hangar-pilots button'),
        ].filter((el) => !el.disabled && !el.closest('[inert]') && el.getClientRects().length);
        if (tabs.length < 2) return false;
        const active = tabs.findIndex((el) => el.getAttribute('aria-pressed') === 'true');
        const target = tabs[(Math.max(0, active) + direction + tabs.length) % tabs.length];
        target.click();
        return true;
    }
}
