import { S, enteredInitials, leaderboardEntries } from '../../runtime/scene-layout.mjs';
import { WIDTH, COLOUR } from '../constants.mjs';

// The full-canvas screens the engine itself can show: the title card, the score summary
// (game over, or top five with initials entry) and the pre-flight countdown.
export class TitleScreen {
    draw({ px, scene }) {
        px.sprite('ship', WIDTH / 2 - 12, 53, 1);
        px.text('ASTEROIDS', WIDTH / 2, 91, COLOUR.ink, 3, 'center');
        px.text('PRESS FIRE TO START', WIDTH / 2, 139, COLOUR.cyan, 1, 'center');
        const [top] = leaderboardEntries(scene);
        const leader = top ? `${top.initials}  ${top.score}` : '---  0';
        px.text(`BEST  ${leader}`, WIDTH / 2, 169, COLOUR.muted, 1, 'center');
        px.text('MOVE  /  SHOOT  /  SURVIVE', WIDTH / 2, 223, COLOUR.muted, 1, 'center');
    }
}

export class SummaryScreen {
    draw({ px, ctx, scene }) {
        px.text(
            scene[S.STATE] === 5 ? 'TOP FIVE!' : 'GAME OVER',
            WIDTH / 2,
            29,
            COLOUR.ink,
            2,
            'center',
        );
        px.text(
            `SCORE ${scene[S.FINAL_SCORE]}${scene[S.FINAL_SCORE] > scene[S.RUN_PRIOR_BEST] ? ' / NEW BEST' : ''}`,
            WIDTH / 2,
            54,
            COLOUR.amber,
            1,
            'center',
        );
        px.text(
            `WAVE ${scene[S.WAVE]} / ${Math.floor(scene[S.GAME_MS] / 1000)}s / ${scene[S.RUN_DESTROYED]} KILLS / x${scene[S.RUN_BEST_MULTIPLIER]}`,
            WIDTH / 2,
            70,
            COLOUR.muted,
            1,
            'center',
        );
        if (scene[S.STATE] === 5) this.entry(px, ctx, scene);
        else this.board(px, scene);
    }
    entry(px, ctx, scene) {
        px.text(enteredInitials(scene), WIDTH / 2, 96, COLOUR.ink, 3, 'center');
        const x = WIDTH / 2 - 27 + scene[S.SELECTED_INITIAL] * 18;
        ctx.fillStyle = COLOUR.cyan;
        ctx.fillRect(x, 122, 15, 2);
        px.text('UP/DOWN: LETTER   LEFT/RIGHT: SLOT', WIDTH / 2, 151, COLOUR.muted, 1, 'center');
        px.text(
            scene[S.SAVE_FAILED] ? 'SAVE FAILED - PRESS FIRE TO RETRY' : 'PRESS FIRE TO SAVE',
            WIDTH / 2,
            181,
            scene[S.SAVE_FAILED] ? COLOUR.hot : COLOUR.cyan,
            1,
            'center',
        );
    }
    board(px, scene) {
        const board = leaderboardEntries(scene);
        for (let i = 0; i < 5; i++) {
            const initials = board[i] ? board[i].initials : '---';
            const score = board[i] ? String(board[i].score).padStart(6, ' ') : '     -';
            px.text(
                `${i + 1}  ${initials}   ${score}`,
                WIDTH / 2,
                92 + i * 20,
                i === scene[S.SAVED_RANK] ? COLOUR.cyan : COLOUR.muted,
                1,
                'center',
            );
        }
        px.text('RELEASE FIRE, THEN PRESS TO RETRY', WIDTH / 2, 219, COLOUR.cyan, 1, 'center');
    }
}

export class Countdown {
    draw({ px, scene }) {
        const count = 3 - Math.floor(scene[S.STATE_AGE_MS] / 500);
        px.text(count > 0 ? count : 'GO', WIDTH / 2, 111, COLOUR.ink, 4, 'center');
    }
}
