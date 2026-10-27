import { adjustField } from '../input/menu-fields.mjs';
import { element } from './dom.mjs';
import { FLIGHT_STATES } from '../state/navigation.mjs';

const ARROWS = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
const ADJUSTABLE = 'select,input[type=range]';

// Routes physical keys to one of three modes: a modal decision, a menu (Settings has a few
// extras), or the flight itself.
export class KeyboardRouter {
    constructor(app) {
        this.app = app;
    }
    install() {
        window.addEventListener('keydown', (event) => this.keyDown(event));
        window.addEventListener('keyup', (event) => {
            const { input, session } = this.app;
            input.physicalKeys.delete(event.code);
            session.keyboardControls()?.keyUp(event.code);
            // macOS swallows the keyup of every key released while Cmd is down, which leaves
            // them "held" for good. Letting go of Cmd drops them; a key still really held
            // comes straight back with its next auto-repeat.
            if (event.key === 'Meta') {
                input.physicalKeys.clear();
                session.keyboardControls()?.keys.clear();
            }
        });
    }
    keyDown(event) {
        const { app } = this,
            { navigation, runtime, menu } = app;
        app.input.device = 'keyboard';
        app.input.physicalKeys.add(event.code);
        if (
            event.repeat &&
            ['Enter', 'Space'].includes(event.code) &&
            (navigation.screen !== 'play' || runtime.state === 'results')
        ) {
            event.preventDefault();
            return;
        }
        if (element('navigationDecision').open) {
            if (ARROWS.includes(event.code)) {
                event.preventDefault();
                menu.focus.move(['ArrowLeft', 'ArrowUp'].includes(event.code) ? -1 : 1);
            }
            return;
        }
        if (app.isSettingsOpen()) this.settingsKey(event);
        else if (app.menuActive()) this.menuKey(event);
        else this.playKey(event);
    }
    settingsKey(event) {
        const { app } = this,
            { menu, keyRebinder } = app;
        if (keyRebinder.active) {
            keyRebinder.handle(event);
            return;
        }
        if (event.code === 'Escape') menu.back(event);
        else if (['ArrowUp', 'ArrowDown'].includes(event.code)) menu.vertical(event);
        else if (event.code === 'Enter' && event.target.matches(ADJUSTABLE)) {
            event.preventDefault();
            menu.toggleEditing();
        } else if (['ArrowLeft', 'ArrowRight'].includes(event.code)) {
            const step = event.code === 'ArrowLeft' ? -1 : 1;
            if (event.target.matches('select')) {
                event.preventDefault();
                adjustField(event.target, step);
            } else if (event.target.matches('[data-category]')) {
                event.preventDefault();
                const tabs = [...document.querySelectorAll('[data-category]')];
                tabs[(tabs.indexOf(event.target) + step + tabs.length) % tabs.length].click();
            }
        }
    }
    menuKey(event) {
        const { menu } = this.app;
        if (event.repeat && ['Enter', 'Space'].includes(event.code)) {
            event.preventDefault();
            return;
        }
        if (this.app.consumeDemo()) {
            event.preventDefault();
            return;
        }
        if (event.code === 'Escape') menu.back(event);
        else if (['ArrowUp', 'ArrowDown'].includes(event.code)) menu.vertical(event);
        else if (
            ['ArrowLeft', 'ArrowRight'].includes(event.code) &&
            event.target.matches(ADJUSTABLE)
        ) {
            event.preventDefault();
            adjustField(event.target, event.code === 'ArrowLeft' ? -1 : 1);
        } else if (event.code === 'Enter' && event.target.matches(ADJUSTABLE)) {
            event.preventDefault();
            menu.toggleEditing();
        } else if (event.code === 'Enter' && !event.target.closest('button,a,input,select')) {
            event.preventDefault();
            menu.scope().querySelector('button:not([hidden]):not(:disabled)')?.click();
        }
    }
    playKey(event) {
        const { app } = this,
            { navigation, runtime, session, settings } = app;
        const controls = session.keyboardControls();
        if (
            navigation.live &&
            ['Escape', controls?.settings.keys.pause ?? settings.keys.pause].includes(event.code)
        ) {
            event.preventDefault();
            if (!event.repeat) {
                session.claimMenu();
                navigation.pause();
            }
            return;
        }
        const keySettings = controls?.settings ?? settings;
        const accepted = [...ARROWS, 'Enter', 'Escape', ...Object.values(keySettings.keys)];
        if (!accepted.includes(event.code)) return;
        if (event.target.closest('button, input, select, textarea')) {
            // Clicking Fullscreen, Music or Sound mid-flight leaves focus on that button. While
            // flying, a game key takes focus back to the field instead of being dropped (and
            // Space no longer presses the button). Anywhere else the control keeps its keys.
            const flying = FLIGHT_STATES.includes(runtime.state);
            if (!flying || !event.target.closest('button')) return;
            app.canvas.focus({ preventScroll: true });
        }
        event.preventDefault();
        app.unlockAudio();
        controls?.keyDown(event.code, event.repeat);
    }
}
