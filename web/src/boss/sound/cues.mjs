import { BOSS } from '../../runtime/scene-layout.mjs';

// Which of a boss's state floats announce a window opening or closing. `field` is an offset
// in the boss block; when it rises past one half the `rise` sound plays, when it falls back
// the `fall` sound (if any). Kinds: 0 Sentinel, 2 Cinderforge, 3 Bastion, 4 Tidecaller,
// 5 Warden, 6 Picket (the engine documents each slot in boss_fights.h).
const GATE = [{ field: BOSS.GATE, rise: 'open', fall: 'close' }];
export const WINDOW_CUES = {
    0: GATE,
    6: GATE,
    2: [{ field: BOSS.AUX + 1, rise: 'open' }],
    3: [{ field: BOSS.AUX + 1, rise: 'gate' }],
    4: [{ field: BOSS.AUX + 2, rise: 'open' }],
    5: [{ field: BOSS.AUX + 1, rise: 'open' }],
};

// Kinds whose panels are blown out one at a time (state 2) rather than removed.
export const PART_BREAK_KINDS = new Set([2, 8]);
