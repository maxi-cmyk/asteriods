// Builds web/assets/soundtracks and writes its manifest.
//   node tools/soundtracks/build.mjs             render the composed tracks, then rebuild the manifest
//   node tools/soundtracks/build.mjs --manifest  rebuild the manifest only (after adding a file)
//   node tools/soundtracks/build.mjs --import <slug> <video-or-audio-file>
//                                                copy a supplied track's audio in (no re-encode)
// Needs ffmpeg and ffprobe on PATH. Every .mp3/.m4a in assets/soundtracks gets a manifest entry:
// its length, where the music audibly ends (supplied tracks end in silence) and a gain that
// brings it to the common loudness, so the game never has to guess.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRACKS } from './tracks.mjs';
import { renderLaunch, renderTrack, wav } from './render.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const music = join(root, 'assets/soundtracks');
const sfx = join(root, 'assets/sfx');
// Integrated loudness every soundtrack is levelled to. Sound effects are quiet synth bleeps, so
// the music sits a little under a streamed track's usual -14 LUFS.
export const TARGET_LUFS = -12;

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
// ffmpeg prints its analysis filters' results on stderr.
const analyse = (file, filter) =>
    spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', filter, '-f', 'null', '-'], {
        encoding: 'utf8',
        maxBuffer: 1 << 26,
    }).stderr;

function measure(file) {
    const seconds = Number(
        run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]),
    );
    const loud = analyse(file, 'ebur128=peak=true');
    const lufs = Number([...loud.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)[1]);
    // Trailing silence (merging blips closer than 0.15 s) is where the music really ends.
    const text = analyse(file, 'silencedetect=n=-50dB:d=0.3');
    const starts = [...text.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
    const stops = [...text.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
    let end = seconds;
    for (let i = starts.length - 1; i >= 0; i--) {
        if (stops[i] !== undefined && stops[i] < end - 0.15) break;
        end = starts[i];
    }
    return { seconds, end, lufs };
}

const TITLES = Object.fromEntries(Object.values(TRACKS).map((t) => [t.id, t.title]));
const titleOf = (id) =>
    TITLES[id] ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function buildManifest() {
    const tracks = {};
    for (const file of readdirSync(music).filter((name) => /\.(mp3|m4a)$/.test(name)).sort()) {
        const id = file.replace(/\.[^.]+$/, '');
        const m = measure(join(music, file));
        const gain = Math.min(1, 10 ** ((TARGET_LUFS - m.lufs) / 20));
        tracks[id] = {
            file,
            title: titleOf(id),
            seconds: +m.seconds.toFixed(3),
            end: +m.end.toFixed(3),
            lufs: +m.lufs.toFixed(1),
            gain: +gain.toFixed(4),
        };
        console.log(
            `${id.padEnd(22)} ${m.seconds.toFixed(1)}s, music ends ${m.end.toFixed(1)}s, ${m.lufs.toFixed(1)} LUFS, gain ${gain.toFixed(2)}`,
        );
    }
    const manifest = { target: TARGET_LUFS, tracks };
    writeFileSync(join(music, 'soundtracks.json'), JSON.stringify(manifest, null, 2) + '\n');
}

function encode(bytes, file) {
    const dir = mkdtempSync(join(tmpdir(), 'soundtrack-'));
    try {
        const input = join(dir, 'in.wav');
        writeFileSync(input, bytes);
        run('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-codec:a', 'libmp3lame', '-b:a', '160k', file]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const [mode, slug, source] = process.argv.slice(2);
mkdirSync(music, { recursive: true });
mkdirSync(sfx, { recursive: true });
if (mode === '--import') {
    if (!slug || !source) throw new Error('usage: --import <slug> <file>');
    run('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-vn', '-c:a', 'copy', join(music, `${slug}.m4a`)]);
    buildManifest();
} else if (mode === '--manifest') buildManifest();
else {
    for (const id of Object.keys(TRACKS)) {
        console.log(`rendering ${id}`);
        encode(wav(renderTrack(id).out), join(music, `${id}.mp3`));
    }
    encode(wav(renderLaunch().out), join(sfx, 'launch.mp3'));
    buildManifest();
}
