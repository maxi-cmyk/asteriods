export const STATES = ['menu', 'countdown', 'playing', 'paused', 'death', 'initials', 'game-over', 'demo'];
export const SCORE_KEY = 'asteroids.web.scores-v3';

export async function createRuntime(bytes, { storage, random, tone = () => {}, scoreKey = SCORE_KEY } = {}) {
  let api;
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
            record.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return 0;
        if (pointer && capacity >= record.length) new Uint8Array(api.memory.buffer, pointer, record.length).set(record);
        return record.length;
      } catch { return 0; }
    },
    browser_storage_write(pointer, length) {
      try {
        if (!storage) return 0;
        storage.setItem(scoreKey, JSON.stringify([...new Uint8Array(api.memory.buffer, pointer, length)]));
        return length;
      } catch { return 0; }
    },
  }};
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  api = instance.exports;
  const runtime = {
    api,
    step({ x = 2048, y = 2048, fire = false, firePressed = false, click = false, pause = false, aimX = 0, aimY = 0, laser = false, precision = false, shield = false } = {}) {
      api.web_fire_press(+firePressed);
      api.web_actions(aimX, aimY, +laser, +precision, +shield);
      api.web_step(x, y, +fire, +click, +pause);
    },
    start(practice = false) { api.web_start(+practice); },
    menu() { api.web_menu(); },
    resetTargets() { api.web_practice_targets(); },
    multishot() { api.web_practice_multishot(); },
    get state() { return STATES[api.web_state()]; },
    get width() { return api.web_width(); },
    get height() { return api.web_height(); },
    fireDiagnostics() { return [...new Uint32Array(api.memory.buffer,api.web_fire_diagnostics(),4)]; },
    scene() { return new Float32Array(api.memory.buffer, api.web_scene(), 512); },
    pixels() { return new Uint8Array(api.memory.buffer, api.web_pixels(), 128 * 64); },
    snapshot() { return [...new Float32Array(api.memory.buffer, api.web_snapshot(), 16)]; },
    pause() { if (runtime.state === 'playing') runtime.step({ pause: true }); },
  };
  api.__wasm_call_ctors();
  api.web_init();
  return runtime;
}
