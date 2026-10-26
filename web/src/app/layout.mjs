import { fitPlayfield } from '../state/navigation.mjs';

// Sizes the playfield to the room left by the console chrome and shares the letterbox
// height with the CSS so the HUD can move into tall bars.
export class Layout {
    constructor(app) {
        this.app = app;
    }
    // An arrow so it can be handed around as a callback.
    fit = () => {
        const { navigation } = this.app;
        if (!navigation || !['play', 'pause'].includes(navigation.screen)) return;
        const field = document.querySelector('.screen'),
            panel = document.querySelector('.console');
        const style = getComputedStyle(panel),
            num = (name) => parseFloat(style[name]) || 0;
        const chrome = [...panel.children].filter(
            (el) =>
                el !== field &&
                !el.hidden &&
                getComputedStyle(el).display !== 'none' &&
                getComputedStyle(el).position !== 'absolute',
        );
        const height = chrome.reduce((n, el) => {
            const s = getComputedStyle(el);
            return (
                n +
                el.getBoundingClientRect().height +
                (parseFloat(s.marginTop) || 0) +
                (parseFloat(s.marginBottom) || 0)
            );
        }, 0);
        const size = fitPlayfield(
            panel.clientWidth - num('paddingLeft') - num('paddingRight'),
            panel.clientHeight -
                num('paddingTop') -
                num('paddingBottom') -
                height -
                num('gap') * chrome.length,
        );
        field.style.width = `${size.width}px`;
        field.style.height = `${size.height}px`;
        // Share the letterbox height so the HUD can move into tall bars.
        const bar = Math.max(0, (panel.clientHeight - size.height) / 2);
        document.body.style.setProperty('--bar', `${bar}px`);
        document.body.dataset.bars = String(bar >= 78);
    };
    observe(...extra) {
        window.addEventListener('resize', this.fit);
        document.addEventListener('fullscreenchange', this.fit);
        for (const node of [document.querySelector('.console'), ...extra])
            new ResizeObserver(() => this.fit()).observe(node);
    }
}
