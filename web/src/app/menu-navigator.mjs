import { adjustField } from '../input/menu-fields.mjs';
import { MenuInput } from '../state/navigation.mjs';
import { element } from './dom.mjs';
import { MenuFocus } from './menu-focus.mjs';

// Everything the player does in a menu: which menu is reachable, focus movement, the
// select-edit mode, and the controller's menu buttons.
export class MenuNavigator {
    constructor(app) {
        this.app = app;
        this.focus = new MenuFocus(() => this.scope());
        this.input = new MenuInput();
        this.editing = false; // a select or slider is being adjusted with the arrows
        this.lastPad = null;
    }
    // The element whose controls the arrows and d-pad can reach right now.
    scope() {
        const { navigation, runtime, demo } = this.app;
        const decision = element('navigationDecision');
        if (decision.open) return decision;
        if (demo?.active) return element('demoControls');
        if (runtime?.state === 'results' && navigation.screen === 'play')
            return element('runSummary');
        if (navigation.screen === 'pause') return element('pauseMenu');
        if (runtime?.coop && runtime.state === 'game-over')
            return document.querySelector('.toolbar');
        return document.querySelector(`[data-view="${navigation.screen}"]`);
    }
    reset() {
        this.input.reset();
    }
    // Up/Down: adjust an open select, otherwise move focus.
    vertical(event) {
        event.preventDefault();
        const direction = event.code === 'ArrowUp' ? -1 : 1;
        if (this.editing && event.target.matches('select')) adjustField(event.target, direction);
        else {
            this.editing = false;
            this.focus.move(direction);
        }
    }
    toggleEditing() {
        this.editing = !this.editing;
    }
    // Escape: leave select-edit mode first, then go back.
    back(event) {
        event.preventDefault();
        if (this.editing) {
            this.editing = false;
            return;
        }
        this.app.navigation.back();
    }
    handlePad(pad, now) {
        const { app } = this,
            { navigation } = app;
        if (!navigation) return;
        const input = this.input.sample(pad, now, app.session.menuPauseButton());
        if (
            !input.direction &&
            !input.horizontal &&
            !input.confirm &&
            !input.back &&
            !input.pause &&
            !input.tab
        )
            return;
        app.input.device = 'controller';
        if (app.consumeDemo()) return;
        if (input.pause && navigation.screen === 'pause' && !navigation.pending) {
            navigation.resume();
            return;
        }
        const field = document.activeElement;
        if (input.tab && !navigation.pending) this.focus.stepTab(input.tab);
        if (input.horizontal && !adjustField(field, input.horizontal))
            this.focus.moveToward(input.horizontal, 0);
        if (input.direction) {
            if (this.editing && field.matches('select')) adjustField(field, input.direction);
            else {
                this.editing = false;
                this.focus.moveToward(0, input.direction);
            }
        }
        if (input.back) {
            if (app.keyRebinder.active) app.keyRebinder.cancel();
            else if (this.editing) this.editing = false;
            else if (navigation.pending) navigation.resolve('stay');
            else navigation.back();
        }
        if (input.confirm) {
            const focused = document.activeElement;
            if (this.scope().contains(focused) && focused.matches('input[type=checkbox],button,a'))
                focused.click();
            else if (focused.matches('select,input[type=range]')) {
                this.editing = !this.editing;
                app.settingsStatus.textContent = this.editing
                    ? 'Left/right adjusts values; up/down changes select options. Circle ends editing.'
                    : 'Cross selects; Circle goes back.';
            } else this.scope().querySelector('button:not([hidden]):not(:disabled)')?.click();
        }
    }
}
