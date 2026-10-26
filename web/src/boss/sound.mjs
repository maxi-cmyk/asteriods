// Boss sound design. Everything is synthesised (no samples), built from a handful
// of voices so each boss has its own timbre:
//   Sentinel / Picket     servo saws and square zaps (a machine)
//   Ringwarden / Shardling  glass: high sines, tinks and shatter noise
//   Cinderforge / Cinderling  fire: low filtered noise, roars and crackle
//   Bastion / Gunnery     ordnance: square thumps, launch whooshes, klaxons
//   Tidecaller / Moonjelly  water: gliding sines with vibrato, bloops and pops
//   Horizon Warden / Lens Imp  cosmic: detuned drones, bent pitches, sub swells
// Each attack has a CHARGE (played as its telegraph starts, as long as the
// warning) and a RELEASE (the lethal moment: hazard live, shot spawned). Every
// boss also has a distinct DEFEAT sound. The game plays them from the scene
// (`BossSound.observe`); the attack gallery plays them by name (`describeSounds`).
//
//   sound/synth.mjs     the Synth: tones and filtered noise on a Web Audio context
//   sound/shapes.mjs    shared sound shapes (arpeggio, boom, pop)
//   sound/book/         each boss group's sounds
//   sound/cues.mjs      which boss state floats announce windows opening and closing
//   sound/observer.mjs  BossSound: turns scene changes into sounds
import { BOOK } from './sound/book/index.mjs';
import { GROUPS } from './sound/groups.mjs';

export { BOOK };
export { groupOf, isMini } from './sound/groups.mjs';
export { Synth, voice } from './sound/synth.mjs';
export { BossSound } from './sound/observer.mjs';

// name -> {play(ctx, dest, t0), seconds, text}: what the gallery lists and plays.
export function describeSounds() {
    const out = [];
    const names = {
        sentinel: 'Sentinel',
        ringwarden: 'Ringwarden',
        cinderforge: 'Cinderforge',
        bastion: 'Bastion',
        tidecaller: 'Tidecaller',
        warden: 'Horizon Warden',
    };
    for (const group of GROUPS) {
        const book = BOOK[group];
        out.push({
            id: `${group}.entrance`,
            label: `${names[group]} entrance`,
            seconds: 3,
            play: (v, o) => book.sting(v, o),
        });
        for (const [attack, fn] of Object.entries(book.charge || {}))
            out.push({
                id: `${group}.charge.${attack}`,
                label: `${names[group]} · attack ${attack} charge`,
                seconds: 1.2,
                play: (v) => fn(v, 0.9),
            });
        out.push({
            id: `${group}.defeat`,
            label: `${names[group]} defeated`,
            seconds: 4.5,
            play: (v) => book.defeat(v),
        });
    }
    return out;
}
