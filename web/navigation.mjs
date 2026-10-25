export const UTILITIES = ['records', 'settings', 'help', 'developer', 'hangar'];
export const LIVE_STATES = ['countdown', 'playing', 'paused', 'death'];
export function routeFromHash(hash) {
  const route = String(hash).replace(/^#/, '').toLowerCase();
  return UTILITIES.includes(route) ? route : 'home';
}
export function fitPlayfield(width, height) {
  const w = Math.max(0, Math.min(width, height * 16 / 9));
  return { width: w, height: w * 9 / 16 };
}

// Browser presentation owns navigation; the existing runtime owns the run.
export class Navigation {
  constructor({ runtime, dirty = () => false, apply = () => {}, discard = () => {}, changed = () => {}, canResume = () => true }) {
    Object.assign(this, { runtime, dirty, apply, discard, changed, canResume });
    this.screen = 'home'; this.origin = 'home'; this.pending = null;
  }
  get live() { return LIVE_STATES.includes(this.runtime.state); }
  get shouldStep() { return this.screen === 'play'; }
  set(screen) { const previous = this.screen; this.screen = screen; this.changed(screen, previous); }
  pause() {
    if (this.runtime.state === 'playing') this.runtime.pause();
    if (this.live) this.set('pause');
  }
  request(target, skipDraft = false) {
    if (!['home', 'pause', 'mode', 'lobby', ...UTILITIES].includes(target)) target = 'home';
    if (this.screen === 'settings' && target !== 'settings' && !skipDraft && this.dirty()) {
      this.pending = { kind: 'draft', target }; this.changed(this.screen, this.screen); return;
    }
    if (target === 'home' && (this.live || ['results','initials'].includes(this.runtime.state))) {
      if(this.live)this.pause(); this.pending = { kind: 'quit', target }; this.changed(this.screen, this.screen); return;
    }
    if (UTILITIES.includes(target)) {
      if (this.live) { this.pause(); this.origin = 'pause'; }
      else this.origin = this.screen === 'mode' ? 'mode' : 'home';
    }
    if (target === 'home' && this.runtime.state !== 'menu') this.runtime.abandon();
    this.set(target);
  }
  back() {
    if (UTILITIES.includes(this.screen)) this.request(this.origin);
    else if (this.screen === 'play') this.pause();
    else if (this.screen === 'pause') this.request('home');
    else if (this.screen === 'lobby') this.request('mode');
    else if (this.screen === 'mode') this.request('home');
  }
  resolve(choice) {
    const pending = this.pending; this.pending = null;
    if (!pending) return;
    if (choice === 'stay') { this.changed(this.screen, this.screen); return; }
    if (pending.kind === 'draft') {
      if (choice === 'apply') this.apply(); else if (choice === 'discard') this.discard(); else return;
      this.request(pending.target, true);
    } else if (choice === 'quit') { this.runtime.abandon(); this.origin = 'home'; this.set('home'); }
  }
  start(practice = false) { this.pending = null; this.runtime.start(practice); this.origin = 'home'; this.set('play'); }
  startCoop(options) { this.pending = null; this.runtime.startCoop(options); this.origin = 'home'; this.set('play'); }
  resume() {
    if (this.screen !== 'pause' || !this.canResume()) return;
    if (this.runtime.state === 'paused') this.runtime.step({ pause: true });
    this.set('play');
  }
  sync() { if (this.screen === 'play' && this.runtime.state === 'paused') this.set('pause'); }
}

// A newly visible menu cannot inherit a held confirm/back/stick input.
export class MenuInput {
  constructor() { this.reset(); }
  reset() { this.armed = false; this.lastDirection = 0; this.nextRepeat = 0; this.held = new Set(); this.lastHorizontal = 0; this.nextHorizontal = 0; }
  sample(pad, now, pauseButton = 9) {
    const down = i => !!pad?.buttons?.[i]?.pressed || (pad?.buttons?.[i]?.value || 0) > .2;
    const direction = down(12) || (pad?.axes?.[1] || 0) < -.55 ? -1 : down(13) || (pad?.axes?.[1] || 0) > .55 ? 1 : 0;
    const horizontal = down(14) || (pad?.axes?.[0] || 0) < -.55 ? -1 : down(15) || (pad?.axes?.[0] || 0) > .55 ? 1 : 0;
    const confirm = down(0), back = down(1), pause = down(pauseButton), previous = down(4), next = down(5);
    if (!this.armed) {
      if (!confirm && !back && !direction && !horizontal && !(pad?.buttons || []).some(b => b?.pressed || b?.value > .2)) this.armed = true;
      return {};
    }
    const result = {};
    if (confirm && !this.held.has('confirm')) result.confirm = true;
    if (back && !this.held.has('back')) result.back = true;
    if (pause && !this.held.has('pause')) result.pause = true;
    // Shoulder buttons step through tabs; each press moves exactly one tab.
    if (previous && !this.held.has('previous')) result.tab = -1;
    else if (next && !this.held.has('next')) result.tab = 1;
    this.held = new Set([...(confirm ? ['confirm'] : []), ...(back ? ['back'] : []), ...(pause ? ['pause'] : []),
      ...(previous ? ['previous'] : []), ...(next ? ['next'] : [])]);
    if (direction && (direction !== this.lastDirection || now >= this.nextRepeat)) {
      result.direction = direction; this.nextRepeat = now + (direction !== this.lastDirection ? 350 : 140);
    }
    if (horizontal && (horizontal !== this.lastHorizontal || now >= this.nextHorizontal)) {
      result.horizontal = horizontal;
      this.nextHorizontal = now + (horizontal !== this.lastHorizontal ? 350 : 140);
    }
    this.lastHorizontal = horizontal;
    this.lastDirection = direction;
    return result;
  }
}
