import { BOSS } from '../../runtime/scene-layout.mjs';
import { BOSS_KIND, auxField } from '../scene.mjs';

// Which of a boss's state floats announce a window opening or closing. `field` is an offset
// in the boss block; when it rises past one half the `rise` sound plays, when it falls back
// the `fall` sound (if any). The aux slots are named in KINDS (src/boss/scene.mjs).
const GATE = [{ field: BOSS.GATE, rise: 'open', fall: 'close' }];
export const WINDOW_CUES = {
    [BOSS_KIND.sentinel]: GATE,
    [BOSS_KIND.picket]: GATE,
    [BOSS_KIND.cinderforge]: [{ field: auxField(BOSS_KIND.cinderforge, 'open'), rise: 'open' }],
    [BOSS_KIND.bastion]: [{ field: auxField(BOSS_KIND.bastion, 'pods'), rise: 'gate' }],
    [BOSS_KIND.tidecaller]: [{ field: auxField(BOSS_KIND.tidecaller, 'exposed'), rise: 'open' }],
    [BOSS_KIND.warden]: [{ field: auxField(BOSS_KIND.warden, 'coreOpen'), rise: 'open' }],
};

// Kinds whose panels are blown out one at a time (state 2) rather than removed.
export const PART_BREAK_KINDS = new Set([BOSS_KIND.cinderforge, BOSS_KIND.cinderling]);
