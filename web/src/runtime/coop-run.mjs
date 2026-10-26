import { CoopLeaderboard } from '../state/coop-records.mjs';
import { InitialsEditor } from './initials-editor.mjs';

// The state of one local co-op run that lives outside the engine: who is playing, which
// end-of-run screen is showing (results, then initials if the team scored high enough) and
// the team leaderboard.
export class CoopRun {
    constructor({ profiles, friendlyFire, storage }) {
        if (
            profiles.length !== 2 ||
            profiles[0] === profiles[1] ||
            profiles.some((p) => ![0, 1].includes(p))
        )
            throw Error('Choose distinct profiles');
        this.profiles = [...profiles];
        this.friendlyFire = !!friendlyFire;
        this.runId = Symbol('co-op run');
        this.phase = null; // null while flying, then 'results' | 'initials' | 'game-over'
        this.board = new CoopLeaderboard(storage, this.friendlyFire);
        this.editor = new InitialsEditor();
        this.saveFailed = false;
    }
    // The flight is over: show the results screen.
    finish() {
        this.phase = 'results';
        this.editor.ready = false;
    }
    // Continue pressed on the results screen.
    advance(score) {
        if (this.phase !== 'results') return;
        this.phase = this.board.qualifies(score) ? 'initials' : 'game-over';
        this.editor.ready = false;
    }
    // One tick of an end-of-run screen. Fire saves the initials once the stick is released.
    stepEnd(input, result) {
        if (this.phase === 'results') return;
        if (!input.fire && !input.firePressed) this.editor.ready = true;
        if (this.phase !== 'initials') return;
        this.editor.navigate(input);
        if (this.editor.ready && input.firePressed) {
            this.editor.ready = false;
            this.saveFailed = !this.board.save(this.runId, this.editor.text, result.score);
            if (!this.saveFailed) this.phase = 'game-over';
        }
    }
}
