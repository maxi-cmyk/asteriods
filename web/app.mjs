import { createRuntime } from './runtime.mjs';
import { Controls, PauseSettingsShortcut } from './controls.mjs';
import { defaults, KEY_ACTIONS, PAD_ACTIONS, PAD_BUTTONS, loadProfiles, saveProfiles, sanitizeSettings, SettingsDraft, keyLabel } from './settings.mjs';
import { setupCalibration } from './calibration.mjs';
import { GameAudio } from './audio.mjs';
import { PixelRenderer, loadArt, WIDTH, HEIGHT } from './renderer.mjs';

const canvas = document.querySelector('#game');
let renderer;
const controllerLabel = document.querySelector('#controller');
const stateLabel = document.querySelector('#state');
const hint = document.querySelector('#hint');
const fireButton = document.querySelector('#fire');
const inputDiagnostics=document.querySelector('#inputDiagnostics');
inputDiagnostics.hidden=!new URLSearchParams(location.search).has('input-fix');
let diagnosticPad=null;
const pauseButton = document.querySelector('#pause');
const soundButton = document.querySelector('#sound');
let storage;
try { storage=localStorage; } catch {}
const profileStore=loadProfiles(storage);
const settings=sanitizeSettings(profileStore.profiles[profileStore.activeProfile]);
try { if (!storage?.getItem('asteroids.web.settings-v1') && matchMedia('(prefers-reduced-motion: reduce)').matches) {
  settings.shake=0;for(const profile of profileStore.profiles)profile.shake=0;
} } catch {}
const controls = new Controls(settings);
const settingsDraft=new SettingsDraft(profileStore,settings);
const pauseShortcut=new PauseSettingsShortcut();
const applyButton=document.querySelector('#applySettings');
const audio = new GameAudio(settings);
const settingsDialog=document.querySelector('#settingsDialog');
const settingsStatus=document.querySelector('#settingsStatus');
const practiceButton=document.querySelector('#practice');
let runtime, activePadIndex=null;
let suspended=false, previousTime=null, accumulator=0;
let lastState='', rebinding=null, pointerPosition=null;
const hud = Object.fromEntries(['lives','wave','score','multiplier','chainFill','laserStatus','laserFill','shieldStatus','precisionStatus'].map(id=>[id,document.getElementById(id)]));
function setTone(value) { audio.setTone(value); }
function unlockAudio() { audio.unlock(); }
function persistSettings() {
  profileStore.profiles[profileStore.activeProfile]=sanitizeSettings(settings);
  settingsStatus.textContent=saveProfiles(storage,profileStore)?'Saved locally':'Storage unavailable; settings apply for this visit';
  syncSettingsEffects();
}
function syncSettingsEffects() {
  audio.apply();
  if(renderer)renderer.shake=settings.shake;
  soundButton.textContent=settings.soundEnabled?'Sound on':'Sound off';
  soundButton.setAttribute('aria-pressed',String(settings.soundEnabled));
}
function markSettingsChanged() {
  const dirty=settingsDraft.changed();
  applyButton.disabled=!dirty;
  settingsStatus.textContent=dirty?'Changes pending — press Apply':'No pending changes';
}
function renderSettings() {
  document.querySelector('#inputProfile').value=profileStore.activeProfile;
  if(!storage)settingsStatus.textContent='Storage unavailable; settings apply for this visit';
  for(const name of ['volume','deadzone','aimDeadzone','aimSensitivity','mouseAimSensitivity','movementSensitivity','shake']) {
    document.getElementById(name).value=settings[name];
    document.getElementById(`${name}Value`).textContent=name.endsWith('Sensitivity')?`${settings[name].toFixed(2)}×`:`${Math.round(settings[name]*100)}%`;
  }
  const keys=document.querySelector('#keyBindings');keys.replaceChildren();
  for(const [action,[title]] of Object.entries(KEY_ACTIONS)) {
    const label=document.createElement('label');label.append(title);
    const button=document.createElement('button');button.type='button';button.textContent=keyLabel(settings.keys[action]);
    button.setAttribute('aria-label',`${title}: ${keyLabel(settings.keys[action])}. Change key`);
    button.addEventListener('click',()=>{rebinding=action;renderSettings();keys.querySelector(`[data-action="${action}"]`).focus();settingsStatus.textContent=`Press a new key for ${title}; Esc cancels`;});
    button.dataset.action=action;
    if(rebinding===action)button.textContent='Press a key…';
    label.append(button);keys.append(label);
  }
  const pads=document.querySelector('#padBindings');pads.replaceChildren();
  for(const [action,[title]] of Object.entries(PAD_ACTIONS)) {
    const label=document.createElement('label');label.append(title);
    const select=document.createElement('select');select.setAttribute('aria-label',`${title} controller button`);select.dataset.action=action;
    for(const [index,name] of PAD_BUTTONS.entries()) {const option=document.createElement('option');option.value=index;option.textContent=name;select.append(option);}
    select.value=settings.buttons[action];
    select.addEventListener('change',()=>{
      const previous=settings.buttons[action],next=Number(select.value);
      const conflict=Object.keys(settings.buttons).find(key=>key!==action && settings.buttons[key]===next);
      if(conflict)settings.buttons[conflict]=previous;
      settings.buttons[action]=next;controls.clear();renderSettings();markSettingsChanged();
      document.querySelector(`#padBindings [data-action="${action}"]`).focus();
    });label.append(select);pads.append(label);
  }
}
for(const name of ['volume','deadzone','aimDeadzone','aimSensitivity','mouseAimSensitivity','movementSensitivity','shake']) {
  document.getElementById(name).addEventListener('input',event=>{
    settings[name]=Number(event.target.value);
    document.getElementById(`${name}Value`).textContent=name.endsWith('Sensitivity')?`${settings[name].toFixed(2)}×`:`${Math.round(settings[name]*100)}%`;
    if(name==='volume') {settings.soundEnabled=true;unlockAudio();}
    markSettingsChanged();
  });
}
const calibration=setupCalibration({settings,findController,persist:markSettingsChanged,render:renderSettings});
document.querySelector('#inputProfile').addEventListener('change',event=>{
  profileStore.profiles[profileStore.activeProfile]=sanitizeSettings(settings);
  profileStore.activeProfile=Number(event.target.value);
  Object.assign(settings,sanitizeSettings(profileStore.profiles[profileStore.activeProfile]));
  rebinding=null;controls.clear();calibration.reset();renderSettings();markSettingsChanged();
});
function openSettings() {
  if(settingsDialog.open)return;
  settingsDraft.begin();applyButton.disabled=true;
  settingsStatus.textContent='No pending changes';
  controls.clear();pointerPosition=null;runtime?.pause();audio.suspend(true);
  calibration.reset();renderSettings();settingsDialog.showModal();if(runtime)draw();
}
document.querySelector('#settingsOpen').addEventListener('click',openSettings);
document.querySelector('#pauseSettings').addEventListener('click',openSettings);
applyButton.addEventListener('click',()=>{
  const saved=settingsDraft.apply(storage);
  controls.clear();calibration.reset();syncSettingsEffects();applyButton.disabled=true;
  settingsStatus.textContent=saved?'Applied and saved locally':'Applied for this visit; storage unavailable';
});
settingsDialog.addEventListener('close',()=>{
  settingsDraft.discard();syncSettingsEffects();rebinding=null;controls.clear();calibration.reset();
  audio.suspend(suspended);previousTime=null;canvas.focus();fitCanvas();
});
settingsDialog.addEventListener('cancel',event=>{if(rebinding){event.preventDefault();rebinding=null;renderSettings();settingsStatus.textContent='Key change canceled';}});
document.querySelector('#resetSettings').addEventListener('click',()=>{
  Object.assign(settings,defaults());if(matchMedia('(prefers-reduced-motion: reduce)').matches)settings.shake=0;
  rebinding=null;controls.clear();calibration.reset();renderSettings();markSettingsChanged();
});
practiceButton.addEventListener('click',()=>{controls.clear();pointerPosition=null;runtime.start(true);canvas.focus();draw();fitCanvas();});
document.querySelector('#resetTargets').addEventListener('click',()=>{runtime.resetTargets();canvas.focus();});
document.querySelector('#practiceMultishot').addEventListener('click',()=>{runtime.multishot();canvas.focus();});
document.querySelector('#endPractice').addEventListener('click',()=>{controls.clear();pointerPosition=null;runtime.menu();canvas.focus();draw();fitCanvas();});
function findController() {
  let pads = [];
  try { pads = [...(navigator.getGamepads?.() || [])]; } catch {}
  const current = pads.find(pad => pad?.index === activePadIndex && pad.connected && pad.mapping === 'standard');
  const pad = current || pads.find(pad => pad?.connected && pad.mapping === 'standard');
  if (activePadIndex !== null && !current && runtime) runtime.pause();
  activePadIndex = pad?.index ?? null;
  const label = pad ? `${pad.id} · connected` : pads.some(Boolean)
    ? 'Controller mapping unavailable · keyboard ready'
    : 'Keyboard ready · connect a controller and press a button';
  if (controllerLabel.textContent !== label) controllerLabel.textContent = label;
  return pad;
}
function draw() {
  const update = (element, text) => { if (element.textContent !== text) element.textContent = text; };
  const scene = runtime.scene();
  renderer.render(scene);
  if(!inputDiagnostics.hidden) {
    const pad=diagnosticPad;
    update(document.querySelector('#inputRaw'),pad
      ? `X: ${pad.buttons[0]?.pressed?'DOWN':'up'} · R2: ${(pad.buttons[7]?.value ?? 0).toFixed(3)} (${pad.buttons[7]?.pressed?'DOWN':'up'}) · L2: ${(pad.buttons[6]?.value ?? 0).toFixed(3)}`
      : 'No controller visible to this tab. Press a controller button with this tab focused.');
    const [presses,shots,pool,laser]=runtime.fireDiagnostics();
    update(document.querySelector('#inputCounts'),`Controller presses detected: ${controls.observedFirePresses} · Game presses: ${presses} · Shots fired: ${shots}`);
    update(document.querySelector('#inputBlocks'),`Rejected — full projectile pool: ${pool} · Laser charging: ${laser} · State: ${runtime.state}`);
  }
  audio.observe(scene);
  const practice=!!scene[60];
  const practicePanel=document.querySelector('#practicePanel');
  if(practicePanel.hidden===practice) {practicePanel.hidden=!practice;fitCanvas();}
  practiceButton.disabled=!['menu','game-over'].includes(runtime.state);
  for(const [index,item] of [...document.querySelectorAll('#practiceGoals li')].entries()) {
    const done=!!(scene[62] & (1<<index));item.classList.toggle('done',done);
    const label=`${item.textContent}: ${done?'complete':'to try'}`;if(item.getAttribute('aria-label')!==label)item.setAttribute('aria-label',label);
  }
  const tried=Array.from({length:5},(_,i)=>!!(scene[62] & (1<<i))).filter(Boolean).length;
  update(document.querySelector('#practiceProgress'),tried===5?'All five skills tried. Keep practicing, or end practice.':`${tried}/5 skills tried. No lives lost. Targets and shields replenish. Scores stay out of the leaderboard.`);
  const results=document.querySelector('#runSummary');
  const showResults=[5,6].includes(scene[0]) && !practice;
  if(results.hidden===showResults) {results.hidden=!showResults;fitCanvas();}
  if(showResults) {
    update(document.querySelector('#personalBest'),scene[27]>scene[59]?'New personal best!':`Personal best: ${Math.max(scene[59],scene[27])}`);
    update(document.querySelector('#resultWave'),String(scene[19]));
    const seconds=Math.floor(scene[2]/1000);
    update(document.querySelector('#resultTime'),`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`);
    update(document.querySelector('#resultKills'),String(scene[57]));
    update(document.querySelector('#resultMultiplier'),`×${scene[58]}`);
  }
  update(hud.lives, String(scene[0]===0 ? 3 : scene[7]).padStart(2,'0'));
  update(hud.wave, String(scene[19] || 1).padStart(2,'0'));
  update(hud.score, String(scene[16]).padStart(6,'0'));
  update(hud.multiplier, `x${scene[17] || 1}`);
  hud.chainFill.style.width = `${scene[18]/3000*100}%`;
  const laserText = scene[47] ? `CHARGING ${(scene[48]/1000).toFixed(1)}s` : scene[49]>0 ? `${(scene[49]/1000).toFixed(1)}s` : 'READY';
  update(hud.laserStatus, laserText);
  hud.laserFill.style.width = `${scene[47]?scene[48]/30:scene[49]>0?(1-scene[49]/7000)*100:100}%`;
  update(hud.shieldStatus, scene[15]?'ACTIVE':scene[55]?'STORED':'EMPTY');
  update(hud.precisionStatus, scene[56]?'PRECISION ON':'PRECISION');
  hud.precisionStatus.classList.toggle('active',!!scene[56]);
  const state = runtime.state;
  document.querySelector('#pauseMenu').hidden=state!=='paused' || settingsDialog.open;
  if (state !== lastState) {
    controls.discardFirePresses();
    lastState = state;
    stateLabel.textContent = state.toUpperCase().replace('-', ' ');
    pauseButton.textContent = state === 'paused' ? 'Resume' : 'Pause';
    pauseButton.disabled = !['playing', 'paused'].includes(state);
    const hints = { demo:'Demo · move or press fire to exit', menu:'Press fire to start', countdown:'Get ready', playing:'Release fire between shots', paused:'Paused · Options / Esc to resume · X on PS4 opens Settings', death:'Ship lost', initials:'Choose three letters, then press fire to save', 'game-over':'Release fire, then press to retry' };
    hint.textContent = hints[state];
  }
}
// Preserve brief controller releases between the fixed simulation ticks.
// No gameplay or DOM work occurs in this input-only polling callback.
setInterval(()=>{
  if(!runtime || suspended || settingsDialog.open)return;
  let pads=[];
  try { pads=navigator.getGamepads?.() || []; } catch {}
  const pad=Array.from(pads).find(p=>p?.index===activePadIndex && p.connected)
    || Array.from(pads).find(p=>p?.connected && p.mapping==='standard');
  controls.observeController(pad);
},4);
function frame(now) {
  requestAnimationFrame(frame);
  const pad=findController();diagnosticPad=pad;
  if(!settingsDialog.open && !suspended)controls.observeController(pad);
  if(pauseShortcut.update(pad,runtime?.state==='paused' && !settingsDialog.open))openSettings();
  if(settingsDialog.open)calibration.update(now);
  if (!runtime || suspended) { previousTime = now; return; }
  const delta = previousTime === null ? 0 : now - previousTime;
  previousTime = now;
  // Advance in exact 20 ms ticks. Long stalls freeze rather than skip physics.
  accumulator += delta > 100 ? 0 : delta;
  while (accumulator >= 20) {
    if(settingsDialog.open) {accumulator=0;break;}
    if(pointerPosition) {
      const rect=canvas.getBoundingClientRect(),scene=runtime.scene();
      controls.aimAt((pointerPosition[0]-rect.left)*WIDTH/rect.width-scene[4],(pointerPosition[1]-rect.top)*HEIGHT/rect.height-scene[5]);
    }
    runtime.step(controls.sample(findController(), now));
    accumulator -= 20;
  }
  draw();
}
window.addEventListener('keydown', event => {
  if(settingsDialog.open) {
    if(rebinding) {
      event.preventDefault();event.stopPropagation();
      if(event.code==='Escape') {const action=rebinding;rebinding=null;renderSettings();document.querySelector(`#keyBindings [data-action="${action}"]`).focus();settingsStatus.textContent='Key change canceled';return;}
      const candidate={...settings,keys:{...settings.keys,[rebinding]:event.code}};
      const conflict=Object.keys(settings.keys).find(key=>key!==rebinding && settings.keys[key]===event.code);
      if(conflict)candidate.keys[conflict]=settings.keys[rebinding];
      if(sanitizeSettings(candidate).keys[rebinding]!==event.code) {settingsStatus.textContent='Choose a letter, number, modifier, Space or punctuation key.';return;}
      const action=rebinding;settings.keys=candidate.keys;rebinding=null;renderSettings();markSettingsChanged();
      document.querySelector(`#keyBindings [data-action="${action}"]`).focus();
    }
    return;
  }
  const accepted=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Escape',...Object.values(settings.keys)];
  if(!accepted.includes(event.code) || event.target.closest('button, input, select, textarea'))return;
  event.preventDefault();unlockAudio();controls.keyDown(event.code,event.repeat);
});
canvas.addEventListener('pointermove', event => {
  if(event.pointerType==='mouse') {pointerPosition=[event.clientX,event.clientY];controls.activateMouseAim();}
});
canvas.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='mouse' || ![0,2].includes(event.button))return;
  event.preventDefault();canvas.focus();controls.activateMouseAim();pointerPosition=[event.clientX,event.clientY];
  controls.pointerDown(event.button,performance.now());
  canvas.setPointerCapture(event.pointerId);
});
window.addEventListener('pointerup',event=>controls.pointerUp(event.button));
canvas.addEventListener('pointercancel',()=>{controls.clear();pointerPosition=null;});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
window.addEventListener('keyup', event => controls.keyUp(event.code));
window.addEventListener('pointerdown', unlockAudio);
function suspend() {
  controls.clear(); runtime?.pause(); suspended = true;
  accumulator = 0; pointerPosition=null; audio.suspend(true);
  if (runtime) draw();
}
window.addEventListener('blur', suspend);
window.addEventListener('focus', () => { suspended = false; previousTime = null; audio.suspend(settingsDialog.open); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspend();
  else { suspended = false; previousTime = null; audio.suspend(settingsDialog.open); }
});
window.addEventListener('gamepaddisconnected', () => { findController(); controls.clear(); });
fireButton.addEventListener('click', () => {
  controls.pulseUntil = performance.now() + 70;
  canvas.focus();
});
pauseButton.addEventListener('click', () => { controls.pauseQueued = true; canvas.focus(); });
soundButton.addEventListener('click', () => {
  unlockAudio();settings.soundEnabled=!settings.soundEnabled;persistSettings();canvas.focus();
});
document.querySelector('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('.console').requestFullscreen();
    canvas.focus();
  } catch { hint.textContent = 'Fullscreen unavailable in this browser'; }
});
function fitCanvas() {
  const screen = document.querySelector('.screen');
  screen.style.removeProperty('width');
  screen.style.removeProperty('height');
  if (!document.fullscreenElement) return;

  const panel = document.querySelector('.console');
  const style = getComputedStyle(panel);
  const spacing = dimension => parseFloat(style[dimension]) || 0;
  const availableWidth = panel.clientWidth - spacing('paddingLeft') - spacing('paddingRight');
  const chromeHeight = [...panel.children].filter(child => child !== screen && child.tagName!=='DIALOG').reduce((height, child) => {
    const childStyle = getComputedStyle(child);
    return height + child.getBoundingClientRect().height
      + (parseFloat(childStyle.marginTop) || 0) + (parseFloat(childStyle.marginBottom) || 0);
  }, 0);
  const availableHeight = Math.max(0, panel.clientHeight - spacing('paddingTop') - spacing('paddingBottom') - chromeHeight);
  const width = Math.min(availableWidth, availableHeight * WIDTH / HEIGHT);
  screen.style.width = `${width}px`;
  screen.style.height = `${width * HEIGHT / WIDTH}px`;
}
window.addEventListener('resize', fitCanvas);
document.addEventListener('fullscreenchange', fitCanvas);
try {
  const response = await fetch('./game.wasm');
  if (!response.ok) throw new Error(`Game download failed (${response.status})`);
  renderer = new PixelRenderer(canvas, await loadArt());
  runtime = await createRuntime(await response.arrayBuffer(), { storage, tone: setTone, scoreKey: 'asteroids.web.hd.scores-v3' });
  fireButton.disabled = false;
  persistSettings();
  window.asteroids = Object.freeze({ snapshot: () => runtime.snapshot(), state: () => runtime.state });
  fitCanvas(); draw(); requestAnimationFrame(frame);
} catch (error) {
  stateLabel.textContent = 'UNAVAILABLE';
  hint.textContent = 'Could not load the game. Serve web/dist over HTTP and reload.';
  console.error(error);
}
