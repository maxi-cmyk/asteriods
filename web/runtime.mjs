import { PersonalBests, clearBrowserRecords } from './records.mjs';
export const STATES = ['menu', 'countdown', 'playing', 'paused', 'death', 'initials', 'game-over', 'demo'];
export const SCORE_KEY = 'asteroids.web.scores-v3';

export async function createRuntime(bytes, { storage, random, tone = () => {}, scoreKey = SCORE_KEY, profile = () => 0 } = {}) {
  let api;
  let scoreStatus=storage?"Top-five scores saved in this browser.":"Storage unavailable; initials cannot be saved.";
  const words = new Uint32Array(64);
  let wordIndex = words.length;
  const nextRandom = random || (() => {
    if (wordIndex === words.length) {
      crypto.getRandomValues(words);
      wordIndex = 0;
    }
    return words[wordIndex++];
  });
  const imports = { env: {
    sinf: Math.sin, cosf: Math.cos, browser_random: nextRandom,
    browser_tone: tone,
    browser_storage_read(pointer, capacity) {
      try {
        const raw = storage?.getItem(scoreKey);
        if (!raw) return 0;
        const record = JSON.parse(raw);
        if (!Array.isArray(record) || record.length !== 42 ||
            record.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {scoreStatus='Saved leaderboard could not be read.';return 0;}
        if (pointer && capacity >= record.length) new Uint8Array(api.memory.buffer, pointer, record.length).set(record);
        return record.length;
      } catch { scoreStatus='Saved leaderboard could not be read.';return 0; }
    },
    browser_storage_write(pointer, length) {
      try {
        if (!storage) {scoreStatus='Storage unavailable; initials cannot be saved.';return 0;}
        storage.setItem(scoreKey, JSON.stringify([...new Uint8Array(api.memory.buffer, pointer, length)]));
        scoreStatus="Top-five scores saved in this browser.";return length;
      } catch { scoreStatus="Could not save initials. Allow browser storage and retry from score entry.";return 0; }
    },
  }};
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  api = instance.exports;
  const records = new PersonalBests(storage);
  let run = null, result = null;
  let resultsVisible = false, resultsReady = false, awaitResultsRelease = false;
  function beginRun(practice = false) {
    run = {profile: profile() === 1 ? 1 : 0, rules: {mode: 'solo', friendlyFire: false, modifiers: [], practice}};
    result = null;
    resultsVisible = false;resultsReady = false;awaitResultsRelease = false;
  }
  function finishRun() {
    if (!run) return;
    const stats = runtime.stats(), scene = runtime.scene();
    result = {...run, score: scene[16], wave: stats.highestWave, peakCps: stats.peakCps,
      longestChain: stats.longestChain, shots: stats.spawned, hits: stats.hits,
      laserShots: stats.laserShots, laserKills: stats.laserKills,
      bossKills: scene[523], elapsedMs: scene[2], destroyed: scene[57], bestMultiplier: scene[58]};
    records.record(run.profile, run.rules, result);
    run = null;
  }
  const runtime = {
    records,
    get scoreStatus() { return scoreStatus; },
    clearRecords() {
      const reset = clearBrowserRecords(storage, scoreKey);
      scoreStatus = reset.message;
      records.status = reset.message;
      if (reset.ok) {
        records.profiles = [{}, {}];
        api.web_reload_scores();
      }
      return reset.ok;
    },
    get result() { return result; },
    get runProfile() { return run?.profile ?? result?.profile ?? (profile() === 1 ? 1 : 0); },
    api,
    step({ x = 2048, y = 2048, fire = false, firePressed = false, click = false, pause = false, aimX = 0, aimY = 0, laser = false, precision = false, shield = false } = {}) {
      if (resultsVisible) {
        api.web_audio_step();
        // Consume the ending press/hold before accepting a separate Continue.
        if (!fire && !firePressed) resultsReady = true;
        else if (resultsReady) runtime.continueResults();
        return;
      }
      if (awaitResultsRelease) {
        if (fire || firePressed) { fire = false; firePressed = false; }
        else awaitResultsRelease = false;
      }
      const previous = runtime.state;
      api.web_fire_press(+firePressed);
      api.web_actions(aimX, aimY, +laser, +precision, +shield);
      api.web_step(x, y, +fire, +click, +pause);
      if (runtime.state === 'countdown' && previous !== 'countdown') beginRun(false);
      if (run && (runtime.state === 'initials' || runtime.state === 'game-over' ||
          (runtime.state === 'death' && runtime.snapshot()[3] === 0))) finishRun();
      if (result && previous === 'death' && ['initials','game-over'].includes(runtime.state)) {
        resultsVisible = true;resultsReady = false;
      }
    },
    start(practice = false) { api.web_start(+practice); beginRun(practice); },
    menu() {
      const practiceEnded = !!run?.rules.practice;
      if (practiceEnded) finishRun(); else run = null;
      api.web_menu();
      resultsVisible = practiceEnded;resultsReady = false;
    },
    abandon() {
      run = null; result = null; resultsVisible = false;
      resultsReady = false; awaitResultsRelease = true;
      api.web_menu();
    },
    continueResults() {
      if (!resultsVisible) return;
      resultsVisible = false;awaitResultsRelease = true;
    },
    resetTargets() { api.web_practice_targets(); },
    doubleFire() { api.web_practice_double_fire(); },
    stats() {
      const values = new Float32Array(api.memory.buffer, api.web_stats(), 16);
      return Object.fromEntries(['cps', 'peakCps', 'spawned', 'hits', 'longestChain', 'highestWave', 'doubleFireMs', 'laserShots', 'laserKills', 'presses', 'pending'].map((key, i) => [key, values[i]]));
    },
    multishot() { api.web_practice_multishot(); },
    get state() { return resultsVisible ? 'results' : STATES[api.web_state()]; },
    get width() { return api.web_width(); },
    get height() { return api.web_height(); },
    fireDiagnostics() { return [...new Uint32Array(api.memory.buffer,api.web_fire_diagnostics(),4)]; },
    scene() { return new Float32Array(api.memory.buffer, api.web_scene(), 576); },
    pixels() { return new Uint8Array(api.memory.buffer, api.web_pixels(), 128 * 64); },
    snapshot() { return [...new Float32Array(api.memory.buffer, api.web_snapshot(), 16)]; },
    pause() { if (runtime.state === 'playing') runtime.step({ pause: true }); },
  };
  api.__wasm_call_ctors();
  api.web_init();
  return runtime;
}
