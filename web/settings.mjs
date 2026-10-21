export const SETTINGS_KEY = 'asteroids.web.settings-v1';
export const KEY_ACTIONS = {
  up:['Move up','KeyW'], down:['Move down','KeyS'], left:['Move left','KeyA'], right:['Move right','KeyD'],
  aimUp:['Aim up','KeyI'], aimDown:['Aim down','KeyK'], aimLeft:['Aim left','KeyJ'], aimRight:['Aim right','KeyL'],
  fire:['Primary fire','Space'], laser:['Charge laser','KeyF'], shield:['Shield','KeyQ'], precision:['Precision','ShiftLeft'], pause:['Pause','KeyP'],
};
export const PAD_ACTIONS = { fire:['Primary fire',7], laser:['Charge laser',6], shield:['Shield',4], precision:['Precision',5], pause:['Pause',9] };
export const PAD_BUTTONS = ['Cross / A','Circle / B','Square / X','Triangle / Y','L1 / LB','R1 / RB','L2 / LT','R2 / RT','Share / Back','Options / Start','L3','R3'];
export function defaults() {
  return { volume:.5, deadzone:.25, aimDeadzone:.35, aimSensitivity:1, mouseAimSensitivity:1, movementSensitivity:1, shake:.5, soundEnabled:false,
    keys:Object.fromEntries(Object.entries(KEY_ACTIONS).map(([key,[,code]])=>[key,code])),
    buttons:Object.fromEntries(Object.entries(PAD_ACTIONS).map(([key,[,index]])=>[key,index])) };
}
export function sanitizeSettings(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const settings=defaults();
  for (const [key,min,max] of [['volume',0,1],['deadzone',.05,.45],['aimDeadzone',.05,.8],['aimSensitivity',.25,2],['mouseAimSensitivity',.25,2],['movementSensitivity',.25,2],['shake',0,1]]) {
    if (Number.isFinite(raw[key])) settings[key]=Math.max(min,Math.min(max,raw[key]));
  }
  if(!Number.isFinite(raw.aimDeadzone))settings.aimDeadzone=Math.max(.35,settings.deadzone);
  // Older settings used one response value for every aiming device.
  if (!Number.isFinite(raw.mouseAimSensitivity)) settings.mouseAimSensitivity=settings.aimSensitivity;
  settings.soundEnabled=raw.soundEnabled===true;
  const used=new Set();
  for (const key of Object.keys(KEY_ACTIONS)) {
    const code=raw.keys?.[key];
    if (typeof code==='string' && /^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ShiftRight|ControlLeft|AltLeft|Backspace|Tab|BracketLeft|BracketRight|Comma|Period|Slash|Semicolon|Quote|Minus|Equal)$/.test(code) && !used.has(code)) {
      settings.keys[key]=code;used.add(code);
    }
  }
  // Reject ambiguous maps as a unit, including conflicts with default bindings.
  if (new Set(Object.values(settings.keys)).size!==Object.keys(KEY_ACTIONS).length) settings.keys=defaults().keys;
  for (const key of Object.keys(PAD_ACTIONS)) {
    const index=raw.buttons?.[key];
    if (Number.isInteger(index) && index>=0 && index<PAD_BUTTONS.length) settings.buttons[key]=index;
  }
  if (new Set(Object.values(settings.buttons)).size!==Object.keys(PAD_ACTIONS).length) settings.buttons=defaults().buttons;
  return settings;
}
export function loadProfiles(storage) {
  let raw;
  try { raw=JSON.parse(storage?.getItem(SETTINGS_KEY) || 'null'); } catch {}
  const profiles=Array.isArray(raw?.profiles)
    ? [sanitizeSettings(raw.profiles[0]),sanitizeSettings(raw.profiles[1])]
    : [sanitizeSettings(raw),defaults()];
  return {activeProfile:raw?.activeProfile===1?1:0,profiles};
}
export function saveProfiles(storage, store) {
  try {
    storage.setItem(SETTINGS_KEY,JSON.stringify({version:2,
      activeProfile:store.activeProfile===1?1:0,
      profiles:[sanitizeSettings(store.profiles[0]),sanitizeSettings(store.profiles[1])]}));
    return true;
  } catch { return false; }
}
export function loadSettings(storage) {
  const store=loadProfiles(storage);
  return store.profiles[store.activeProfile];
}
export function saveSettings(storage, settings) {
  const store=loadProfiles(storage);
  store.profiles[store.activeProfile]=settings;
  return saveProfiles(storage,store);
}
export function keyLabel(code) { return code==='Space'?'Space':code.replace(/^Key|^Digit/,'').replace('Left',' left').replace('Right',' right'); }

// Settings preview uses the live object while gameplay is frozen. Only Apply
// commits the draft profiles; closing restores the last applied snapshot.
export class SettingsDraft {
  constructor(store,settings) { this.store=store;this.settings=settings;this.begin(); }
  begin() { this.baseline=JSON.stringify(this.store); }
  changed() {
    this.store.profiles[this.store.activeProfile]=sanitizeSettings(this.settings);
    return JSON.stringify(this.store)!==this.baseline;
  }
  apply(storage) {
    this.changed();
    const saved=saveProfiles(storage,this.store);
    this.begin();return saved;
  }
  discard() {
    Object.assign(this.store,JSON.parse(this.baseline));
    Object.assign(this.settings,sanitizeSettings(this.store.profiles[this.store.activeProfile]));
  }
}
