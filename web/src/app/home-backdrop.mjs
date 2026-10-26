import { drawHome } from '../render/presentation.mjs';
import { element } from './dom.mjs';
import { reducedQuery } from './motion.mjs';

// The animated layer over the Home backdrop, redrawn at 20 fps (or once when reduced).
export class HomeBackdrop {
    constructor(app) {
        this.app = app;
        this.ctx = element('homeFx').getContext('2d');
        this.lastFrame = -1;
    }
    invalidate() {
        this.lastFrame = -1;
    }
    frame() {
        const { app } = this;
        if (app.navigation?.screen !== 'home' || app.demo?.active || app.loop.suspended) return;
        const time = app.clock.time * app.settings.backgroundMotion;
        const frame = reducedQuery.matches ? -2 : Math.floor(time / 50);
        if (frame === this.lastFrame) return;
        drawHome(this.ctx, time, {
            reduced: reducedQuery.matches,
            art: app.gameArt,
            hull: app.hangarStore.profiles[app.profileStore.activeProfile],
        });
        this.lastFrame = frame;
    }
}
