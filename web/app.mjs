import {createDemo} from './demo/engine.mjs';
import { Navigation, MenuInput, routeFromHash, fitPlayfield } from './navigation.mjs';
import { accuracyText } from './records.mjs';
import { createRuntime } from './runtime.mjs';
import { Controls } from './controls.mjs';
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
const applyButton=document.querySelector('#applySettings');
const audio = new GameAudio(settings);
const settingsStatus=document.querySelector('#settingsStatus');
const practiceButton=document.querySelector('#practice');
let runtime, navigation, demoEngine, activePadIndex=null;
let settingsCategory="controls", lastHelpDevice="";
const menuInput=new MenuInput();
const physicalKeys=new Set(), pointerButtons=new Set();
let gameplayReady=false, routeFromHistory=false, lastMenuPad=null;
const focusOrigins=new Map();
function isSettingsOpen() { return navigation?.screen==='settings'; }
let resetRecordsArmed=false;
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
  document.querySelector('#audioEnabled').checked=settings.soundEnabled;
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
function selectCategory(category) {
  settingsCategory=category;
  for(const button of document.querySelectorAll('[data-category]'))button.setAttribute('aria-pressed',String(button.dataset.category===category));
  for(const panel of document.querySelectorAll('[data-settings-panel]')){panel.hidden=panel.dataset.settingsPanel!==category;panel.inert=panel.hidden;}
  rebinding=null;renderSettings();
}
for(const button of document.querySelectorAll('[data-category]'))button.addEventListener('click',()=>{selectCategory(button.dataset.category);button.focus();});
document.querySelector('#audioEnabled').addEventListener('change',event=>{settings.soundEnabled=event.target.checked;markSettingsChanged();});
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
function openSettings(event) { navigate('settings',event.currentTarget); }
document.querySelector('#settingsOpen').addEventListener('click',openSettings);
document.querySelector('#pauseSettings').addEventListener('click',openSettings);
function applyDraft() {
  const saved=settingsDraft.apply(storage);
  controls.clear();calibration.reset();syncSettingsEffects();applyButton.disabled=true;
  settingsStatus.textContent=saved?'Applied and saved locally':'Applied for this visit; storage unavailable';
}
applyButton.addEventListener('click',applyDraft);
document.querySelector('#resetSettings').addEventListener('click',()=>{
  Object.assign(settings,defaults());if(matchMedia('(prefers-reduced-motion: reduce)').matches)settings.shake=0;
  rebinding=null;controls.clear();calibration.reset();renderSettings();markSettingsChanged();
});
practiceButton.addEventListener('click',()=>{if(consumeDemo())return;navigation.start(true);});
document.querySelector('#resetTargets').addEventListener('click',()=>{runtime.resetTargets();canvas.focus();});
document.querySelector('#practiceDoubleFire').addEventListener('click',()=>{runtime.doubleFire();canvas.focus();});
document.querySelector('#practiceMultishot').addEventListener('click',()=>{runtime.multishot();canvas.focus();});
document.querySelector('#endPractice').addEventListener('click',()=>{controls.clear();pointerPosition=null;runtime.menu();navigation.set('play');draw();fitCanvas();});
document.querySelector('#continueResults').addEventListener('click',()=>{
  runtime.continueResults();controls.clear();gameplayReady=false;menuInput.reset();pointerPosition=null;
  if(runtime.state==='menu')navigation.request('home');
  draw();
});
function disarmRecordsReset() {
  resetRecordsArmed=false;
  document.querySelector('#resetRecords').textContent='Reset this profile’s personal bests';
  document.querySelector('#cancelResetRecords').hidden=true;
}
document.querySelector('#cancelResetRecords').addEventListener('click',disarmRecordsReset);
for(const id of ['recordsProfile','recordsType'])document.getElementById(id).addEventListener('change',()=>{disarmRecordsReset();draw();});
document.querySelector('#recordsProfile').value=profileStore.activeProfile;
let resetProfile;
document.querySelector('#resetRecords').addEventListener('click',()=>{
  const current=Number(document.querySelector('#recordsProfile').value);
  if(!resetRecordsArmed || resetProfile!==current) {
    resetRecordsArmed=true;resetProfile=current;
    document.querySelector('#resetRecords').textContent=`Confirm reset for Player ${current+1}`;
    document.querySelector('#cancelResetRecords').hidden=false;
    document.querySelector('#recordsStatus').textContent='Clears all personal bests for this profile, including practice. Top-five scores are kept.';
    return;
  }
  runtime.records.reset(current);disarmRecordsReset();draw();
});
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
  const compact=pad?'Controller connected':'Keyboard + mouse';
  controllerLabel.textContent=pad?compact:label;
  document.querySelector('#runDevice').textContent=pad?compact:'Keyboard + mouse';
  if(navigation?.screen==='help')renderHelp(!!pad);
  return pad;
}
function draw() {
  const update = (element, text) => { if (element.textContent !== text) element.textContent = text; };
  const scene = runtime.scene();
  if(['play','pause','home'].includes(navigation.screen) && runtime.state!=='results')renderer.render(scene);
  const watching=!!demoEngine?.active && navigation.screen==='home';
  document.querySelector('#homeDemo').hidden=!watching;
  document.querySelector('#demoControls').hidden=!watching;
  document.querySelector('#screenTitle').hidden=watching;
  document.querySelector('#homeHint').hidden=watching;
  document.querySelector('#demoHint').hidden=!watching;
  controllerLabel.hidden=watching;
  document.body.dataset.demo=String(watching);
  document.querySelector('.home-menu').hidden=watching;
  document.querySelector('#homeHint').textContent=watching?'Demo flight · any key or controller action returns Home':'Arrow keys / D-pad to navigate · Enter / Cross to select';
  if(watching)demoEngine.render();
  document.querySelector('#profileLabel').textContent=`Player ${profileStore.activeProfile+1}`;
  if(!inputDiagnostics.hidden) {
    const pad=diagnosticPad;
    update(document.querySelector('#inputRaw'),pad
      ? `X: ${pad.buttons[0]?.pressed?'DOWN':'up'} · R2: ${(pad.buttons[7]?.value ?? 0).toFixed(3)} (${pad.buttons[7]?.pressed?'DOWN':'up'}) · L2: ${(pad.buttons[6]?.value ?? 0).toFixed(3)}`
      : 'No controller visible to this tab. Press a controller button with this tab focused.');
    const [presses,shots,pool,laser]=runtime.fireDiagnostics();
    update(document.querySelector('#inputCounts'),`Controller presses detected: ${controls.observedFirePresses} · Game presses: ${presses} · Shots fired: ${shots}`);
    update(document.querySelector('#inputBlocks'),`Rejected — full projectile pool: ${pool} · Laser charging: ${laser} · State: ${runtime.state}`);
  }
  audio.suspend(suspended || navigation.screen!=='play');
  audio.observe(scene);
  const practice=!!scene[60];
  const title=navigation.screen==='pause'?'Paused':runtime.state==='results'?'Results':runtime.state==='initials'?'Save initials':runtime.state==='game-over'?'Leaderboard':practice?'Practice':'Solo flight';
  if(['play','pause'].includes(navigation.screen)){update(document.querySelector('#screenTitle'),title);document.title=`${title} · Asteroids`;}
  update(document.querySelector('#runLabel'),practice || runtime.state==='results' && runtime.result?.rules.practice?'Practice flight':'Solo flight');
  const practicePanel=document.querySelector('#practicePanel');
  if(practicePanel.hidden===practice) {practicePanel.hidden=!practice;fitCanvas();}
  practiceButton.disabled=false;
  for(const [index,item] of [...document.querySelectorAll('#practiceGoals li')].entries()) {
    const done=!!(scene[62] & (1<<index));item.classList.toggle('done',done);
    const label=`${item.textContent}: ${done?'complete':'to try'}`;if(item.getAttribute('aria-label')!==label)item.setAttribute('aria-label',label);
  }
  const tried=Array.from({length:5},(_,i)=>!!(scene[62] & (1<<i))).filter(Boolean).length;
  update(document.querySelector('#practiceProgress'),tried===5?'All five skills tried. Keep practicing, or end practice.':`${tried}/5 skills tried. No lives lost. Targets and shields replenish. Scores stay out of the leaderboard.`);
  const results=document.querySelector('#runSummary');
  const result=runtime.result;
  const showResults=runtime.state==='results';
  const stats=runtime.stats();
  update(document.querySelector('#doubleFireStatus'),stats.doubleFireMs?`${(stats.doubleFireMs/1000).toFixed(1)}s`:'INACTIVE');
  update(document.querySelector('#liveCps'),String(stats.cps));
  update(document.querySelector('#liveAccuracy'),accuracyText(stats.hits,stats.spawned));
  update(document.querySelector('#liveChain'),String(stats.longestChain));
  const recordProfile=Number(document.querySelector('#recordsProfile').value);
  if(resetRecordsArmed && resetProfile!==recordProfile)disarmRecordsReset();
  const recordRules={practice:document.querySelector('#recordsType').value==='practice'};
  const best=runtime.records.get(recordProfile,recordRules);
  update(document.querySelector('#recordsScope'),`Player ${recordProfile+1} · Solo · ${recordRules.practice?'Practice':'Normal'} · Friendly fire off · No modifiers`);
  const metrics=document.querySelector('#recordsValues'),signature=JSON.stringify(best);
  if(metrics.dataset.signature!==signature){
    metrics.dataset.signature=signature;metrics.replaceChildren();
    if(!best){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='No completed runs yet';dd.className='empty-record';dd.textContent='Finish a run to set your first personal bests.';metrics.append(dt,dd);}
    else for(const [label,value] of [['Score',best.score],['Highest wave',best.wave],['Peak CPS',best.peakCps],['Longest chain',best.longestChain]]){
      const cell=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;cell.append(dt,dd);metrics.append(cell);
    }
  }
  document.querySelector('#retryRecords').hidden=!runtime.records.status.startsWith('Could not save');
  update(document.querySelector('#leaderboardStatus'),runtime.scoreStatus);
  update(document.querySelector('#recordsAccuracy'),best?.accuracy?`Best accuracy: ${accuracyText(best.accuracy.hits,best.accuracy.shots)}`:'Best accuracy: — (requires at least 50 projectiles in a run)');
  if(!resetRecordsArmed)update(document.querySelector('#recordsStatus'),runtime.records.status);
  if(results.hidden===showResults) {
    results.hidden=!showResults;
    canvas.inert=showResults;canvas.setAttribute('aria-hidden',String(showResults));
    if(showResults)results.focus({preventScroll:true});
    else if(lastState==='results')canvas.focus({preventScroll:true});
  }
  if(showResults) {
    update(document.querySelector('#continueResults'),result.rules.practice?'Return to Home':scene[0]===5?'Continue to score saving':'Continue to leaderboard');
    update(document.querySelector('#personalBest'),`${result.rules.practice?'Practice complete':'Run complete'} · Player ${result.profile+1}`);
    update(document.querySelector('#resultScore'),String(result.score));
    update(document.querySelector('#resultCps'),String(result.peakCps));
    update(document.querySelector('#resultAccuracy'),accuracyText(result.hits,result.shots));
    update(document.querySelector('#resultChain'),String(result.longestChain));
    update(document.querySelector('#resultLaser'),`Laser: ${result.laserShots} discharges · ${result.laserKills} kills`);
    update(document.querySelector('#resultWave'),String(result.wave));
    const seconds=Math.floor(result.elapsedMs/1000);
    update(document.querySelector('#resultTime'),`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`);
    update(document.querySelector('#resultKills'),String(result.destroyed));
    update(document.querySelector('#resultMultiplier'),`×${result.bestMultiplier}`);
  }
  update(hud.lives, String(scene[0]===0 ? 3 : scene[7]).padStart(2,'0'));
  update(hud.wave, String(scene[19] || 1).padStart(2,'0'));
  update(hud.score, String(scene[16]).padStart(6,'0'));
  update(hud.multiplier, `x${scene[17] || 1}`);
  hud.chainFill.style.width = `${scene[18]/3000*100}%`;
  const laserText = scene[47] ? `CHARGING ${(scene[48]/1000).toFixed(1)}s` : scene[49]>0 ? `${(scene[49]/1000).toFixed(1)}s` : 'READY';
  update(hud.laserStatus, laserText);
  hud.laserFill.style.width = `${scene[47]?scene[48]/15:scene[49]>0?(1-scene[49]/5000)*100:100}%`;
  update(hud.shieldStatus, scene[15]?'ACTIVE':scene[55]?'STORED':'EMPTY');
  update(hud.precisionStatus, scene[56]?'PRECISION ON':'PRECISION');
  hud.precisionStatus.classList.toggle('active',!!scene[56]);
  const state = runtime.state;
  document.querySelector('#pauseMenu').hidden=navigation.screen!=='pause';
  practicePanel.inert=navigation.screen!=='play' || showResults;
  document.querySelector('.toolbar').inert=navigation.screen==='pause' || showResults;
  if(!showResults)canvas.inert=navigation.screen!=='play';
  document.querySelector('#gameHome').hidden=state!=='game-over';
  fireButton.hidden=!['initials','game-over'].includes(state);
  fireButton.textContent=state==='initials'?(scene[30]?'Retry saving initials':'Save initials'):'Play again';
  soundButton.disabled=isSettingsOpen();
  pauseButton.hidden=!['playing','countdown','death','paused'].includes(state);
  const leaderboard=document.querySelector('#leaderboard');
  const rows=Array.from({length:Math.min(5,scene[31])},(_,i)=>{const at=486+i*5;return `${String.fromCharCode(...scene.subarray(at+1,at+4))}    ${scene[at]}`;});
  const text=rows.join('|');
  if(leaderboard.dataset.rows!==text) {leaderboard.dataset.rows=text;leaderboard.replaceChildren(...(rows.length?rows:['No scores saved yet.']).map(value=>{const li=document.createElement('li');li.textContent=value;return li;}));}
  if(state==='initials')hint.textContent=scene[30]?'Could not save initials. Allow browser storage, then choose Retry saving initials.':'Choose your initials with the direction keys, then Save initials.';
  if (state !== lastState) {
    controls.discardFirePresses();menuInput.reset();gameplayReady=false;
    lastState = state;
    stateLabel.textContent = state.toUpperCase().replace('-', ' ');
    pauseButton.textContent = navigation.screen === 'pause' ? 'Resume' : 'Pause';
    pauseButton.disabled = !navigation.live;
    const hints = { results:'Run complete · review your stats, then continue', demo:'Demo · move or press fire to exit', menu:'Press fire to start', countdown:'Get ready', playing:'Release fire between shots', paused:'Paused · choose Resume or press Options · Esc goes back', death:'Ship lost', initials:'Choose three letters, then press fire to save', 'game-over':'Release fire, then press to retry' };
    hint.textContent = hints[state];
  }
}
// Preserve brief controller releases between the fixed simulation ticks.
// No gameplay or DOM work occurs in this input-only polling callback.
setInterval(()=>{
  if(!runtime || suspended || navigation.screen!=='play' || runtime.state==='results' || !gameplayReady)return;
  let pads=[];
  try { pads=navigator.getGamepads?.() || []; } catch {}
  const pad=Array.from(pads).find(p=>p?.index===activePadIndex && p.connected)
    || Array.from(pads).find(p=>p?.connected && p.mapping==='standard');
  controls.observeController(pad);
},4);
function frame(now) {
  requestAnimationFrame(frame);
  const pad=findController();diagnosticPad=pad;
  if(gameplayReady && navigation.screen==='play' && runtime.state!=='results' && !suspended)controls.observeController(pad);
  const padId=pad?.index ?? null;
  if(padId!==lastMenuPad){menuInput.reset();lastMenuPad=padId;gameplayReady=false;if(pad)document.querySelector('#pauseSettingsHint').textContent='Release controls before selecting Resume · Cross: select · Circle: back';}
  if(!suspended && (navigation?.screen!=='play' || runtime?.state==='results' || navigation.pending))handleMenuPad(pad,now);
  // Cross confirms the focused menu action; gameplay bindings stay separate.
  if(isSettingsOpen() && settingsCategory==='calibration')calibration.update(now);
  if (!runtime || suspended) { previousTime = now; return; }
  const delta = previousTime === null ? 0 : now - previousTime;
  previousTime = now;
  // Advance in exact 20 ms ticks. Long stalls freeze rather than skip physics.
  accumulator += delta > 100 ? 0 : delta;
  while (accumulator >= 20) {
    if((!navigation.shouldStep && !demoEngine?.active) || document.querySelector('#navigationDecision').open) {accumulator=0;break;}
    if(pointerPosition) {
      const rect=canvas.getBoundingClientRect(),scene=runtime.scene();
      controls.aimAt((pointerPosition[0]-rect.left)*WIDTH/rect.width-scene[4],(pointerPosition[1]-rect.top)*HEIGHT/rect.height-scene[5]);
    }
    if(navigation.screen==='home') demoEngine?.step();
    else if(runtime.state==='results') runtime.step();
    else {
      const held=physicalKeys.size || pointerButtons.size || (pad?.buttons || []).some(b=>b?.pressed || b?.value>.2) || (pad?.axes || []).some(v=>Math.abs(v)>.55);
      if(!gameplayReady && !held){controls.clear();gameplayReady=true;}
      runtime.step(gameplayReady?controls.sample(findController(),now):{});
      navigation.sync();
    }
    accumulator -= 20;
  }
  draw();
}
window.addEventListener('keydown', event => {
  physicalKeys.add(event.code);
  if(document.querySelector('#navigationDecision').open){
    if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.code)){event.preventDefault();moveMenuFocus(['ArrowLeft','ArrowUp'].includes(event.code)?-1:1);}
    return;
  }
  if(isSettingsOpen()) {
    if(!rebinding && event.code==='Escape'){event.preventDefault();navigation.back();return;}
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
  if(navigation?.screen!=='play' || runtime?.state==='results' || navigation.pending) {
    if(event.repeat && ['Enter','Space'].includes(event.code)){event.preventDefault();return;}
    if(consumeDemo()){event.preventDefault();return;}
    if(event.code==='Escape'){event.preventDefault();navigation.back();return;}
    if(['ArrowUp','ArrowDown'].includes(event.code) && !event.target.closest('input,select')){event.preventDefault();moveMenuFocus(event.code==='ArrowUp'?-1:1);return;}
    if(event.code==='Enter' && !event.target.closest('button,a,input,select')){event.preventDefault();const scope=menuScope();scope.querySelector('button:not([hidden]):not(:disabled)')?.click();}
    return;
  }
  if(navigation.live && ['Escape',settings.keys.pause].includes(event.code)){event.preventDefault();if(!event.repeat)navigation.pause();return;}
  const accepted=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Escape',...Object.values(settings.keys)];
  if(!accepted.includes(event.code) || event.target.closest('button, input, select, textarea'))return;
  event.preventDefault();unlockAudio();controls.keyDown(event.code,event.repeat);
});
canvas.addEventListener('pointermove', event => {
  if(navigation.screen==='play' && event.pointerType==='mouse') {pointerPosition=[event.clientX,event.clientY];controls.activateMouseAim();}
});
canvas.addEventListener('pointerdown',event=>{
  if(navigation.screen!=='play' || event.pointerType!=='mouse' || ![0,2].includes(event.button))return;
  event.preventDefault();canvas.focus();controls.activateMouseAim();pointerPosition=[event.clientX,event.clientY];
  controls.pointerDown(event.button,performance.now());
  canvas.setPointerCapture(event.pointerId);
});
window.addEventListener('pointerup',event=>controls.pointerUp(event.button));
canvas.addEventListener('pointercancel',()=>{controls.clear();pointerPosition=null;});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
window.addEventListener('keyup', event => {physicalKeys.delete(event.code);controls.keyUp(event.code);});
window.addEventListener('pointerdown',event=>pointerButtons.add(event.button));
window.addEventListener('pointerup',event=>pointerButtons.delete(event.button));
window.addEventListener('pointerdown', unlockAudio);
function suspend() {
  controls.clear();physicalKeys.clear();pointerButtons.clear();navigation?.pause();suspended = true;
  accumulator = 0; pointerPosition=null; audio.suspend(true);
  if (runtime) draw();
}
window.addEventListener('blur', suspend);
window.addEventListener('focus', () => { suspended = false; previousTime = null; audio.suspend(isSettingsOpen()); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspend();
  else { suspended = false; previousTime = null; audio.suspend(isSettingsOpen()); }
});
window.addEventListener('gamepaddisconnected', () => { findController(); controls.clear();menuInput.reset();gameplayReady=false;document.querySelector('#pauseSettingsHint').textContent='Controller disconnected. Reconnect and release controls, or continue with keyboard.'; });
fireButton.addEventListener('click', () => {
  if(runtime?.state==='results') {runtime.continueResults();controls.discardFirePresses();draw();return;}
  controls.pulseUntil = performance.now() + 70;
  canvas.focus();
});
pauseButton.addEventListener('click', () => {if(navigation.screen==='pause')navigation.resume();else navigation.pause();draw();});
soundButton.addEventListener('click', () => {
  unlockAudio();settings.soundEnabled=!settings.soundEnabled;persistSettings();soundButton.focus();
});
document.querySelector('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('.app-shell').requestFullscreen();
    document.querySelector('#fullscreen').focus();
    fitCanvas();
  } catch { hint.textContent = 'Fullscreen unavailable in this browser'; }
});
function fitCanvas() {
  if(!navigation || !['play','pause'].includes(navigation.screen))return;
  const field=document.querySelector('.screen'), panel=document.querySelector('.console');
  const style=getComputedStyle(panel),num=name=>parseFloat(style[name])||0;
  const chrome=[...panel.children].filter(el=>el!==field && !el.hidden && getComputedStyle(el).display!=='none');
  const height=chrome.reduce((n,el)=>{const s=getComputedStyle(el);return n+el.getBoundingClientRect().height+(parseFloat(s.marginTop)||0)+(parseFloat(s.marginBottom)||0);},0);
  const size=fitPlayfield(panel.clientWidth-num('paddingLeft')-num('paddingRight'),panel.clientHeight-num('paddingTop')-num('paddingBottom')-height-num('gap')*chrome.length);
  field.style.width=`${size.width}px`;field.style.height=`${size.height}px`;
}
window.addEventListener('resize', fitCanvas);
document.addEventListener('fullscreenchange', fitCanvas);
function consumeDemo() {
  if(demoEngine?.active) {demoEngine.stop();controls.clear();menuInput.reset();draw();document.querySelector('#watchDemo').focus();return true;}
  return false;
}
function navigate(target,invoker=document.activeElement) {
  if(!navigation)return;
  if(consumeDemo())return;
  focusOrigins.set(navigation.screen,invoker);
  navigation.request(target);
}
function menuScope() {
  const decision=document.querySelector('#navigationDecision');
  if(decision.open)return decision;
  if(demoEngine?.active)return document.querySelector('#demoControls');
  if(runtime?.state==='results' && navigation.screen==='play')return document.querySelector('#runSummary');
  if(navigation.screen==='pause')return document.querySelector('#pauseMenu');
  return document.querySelector(`[data-view="${navigation.screen}"]`);
}
function moveMenuFocus(direction) {
  const nodes=[...menuScope().querySelectorAll('button,a,input,select')].filter(el=>!el.disabled && !el.hidden && el.getClientRects().length);
  if(!nodes.length)return;
  const current=nodes.indexOf(document.activeElement);
  nodes[(current+direction+nodes.length)%nodes.length].focus();
}
function handleMenuPad(pad,now) {
  if(!navigation)return;
  const input=menuInput.sample(pad,now,settings.buttons.pause);
  if(!input.direction && !input.confirm && !input.back && !input.pause)return;
  if(consumeDemo())return;
  if(input.pause && navigation.screen==='pause' && !navigation.pending){navigation.resume();return;}
  if(input.direction)moveMenuFocus(input.direction);
  if(input.back) {
    if(navigation.pending)navigation.resolve('stay');else navigation.back();
  }
  if(input.confirm){const focused=document.activeElement;if(menuScope().contains(focused) && focused.matches('button,a'))focused.click();else menuScope().querySelector('button:not([hidden]):not(:disabled)')?.click();}
}
function screenChanged(screen,previous) {
  if(screen!=='home')demoEngine?.stop();
  controls.clear();gameplayReady=false;pointerPosition=null;accumulator=0;previousTime=null;menuInput.reset();
  if(previous==='settings' && screen!=='settings'){settingsDraft.discard();syncSettingsEffects();rebinding=null;calibration.reset();}
  if(screen==='settings' && previous!=='settings'){
    selectCategory('controls');settingsDraft.begin();applyButton.disabled=true;settingsStatus.textContent='No pending changes';calibration.reset();renderSettings();
  }
  const view=screen==='pause'?'play':screen;
  for(const el of document.querySelectorAll('[data-view]')){el.hidden=el.dataset.view!==view;el.inert=el.hidden;}
  document.body.dataset.screen=screen;
  const titles={home:'Asteroids',play:'Solo flight',pause:'Paused',records:'Records',settings:'Settings',help:'How to Play',developer:'Developer tools'};
  document.querySelector('#screenTitle').textContent=titles[screen];
  document.querySelector('#screenBack').hidden=['home','play','pause'].includes(screen);
  document.title=screen==='home'?'Asteroids':`${titles[screen]} · Asteroids`;
  document.querySelector('#helpPractice').hidden=navigation.origin==='pause';
  document.querySelector('#helpPaused').hidden=navigation.origin!=='pause';
  if(runtime){draw();fitCanvas();}
  const decision=document.querySelector('#navigationDecision');
  if(navigation.pending){
    const draft=navigation.pending.kind==='draft',postRun=['results','initials'].includes(runtime.state);
    document.querySelector('#decisionTitle').textContent=draft?'Unapplied settings':postRun?'Leave score review?':'Quit this run?';
    document.querySelector('#decisionMessage').textContent=draft?'Apply your changes, discard them, or stay here.':postRun?'Any initials you have not saved will be lost. Your personal bests are kept.':'Your current run will end. Stay paused to keep playing.';
    for(const button of decision.querySelectorAll('[data-decision]'))button.hidden=draft?button.dataset.decision==='quit':['apply','discard'].includes(button.dataset.decision);
    decision.querySelector('[data-decision="quit"]').textContent=postRun?'Leave to Home':'Quit run';
    if(!decision.open)decision.showModal();decision.querySelector('[data-decision="stay"]').focus();
  } else {
    if(decision.open)decision.close();
    const restore=focusOrigins.get(screen);
    if(restore?.isConnected && !restore.closest('[hidden]'))restore.focus();
    else if(screen==='home')document.querySelector('#play').focus();
    else if(screen==='pause')document.querySelector('#resume').focus();
    else if(screen==='play')canvas.focus();
    else document.querySelector(`[data-view="${view}"] h1`)?.focus();
  }
  const hash=`#${['play','pause'].includes(screen)?'play':screen}`;
  if(location.hash!==hash){
    if(routeFromHistory || navigation.pending)history.replaceState(null,'',hash);else history.pushState(null,'',hash);
  }
}
function renderHelp(controller) {
  const signature=JSON.stringify([controller,settings]);
  if(lastHelpDevice===signature)return;lastHelpDevice=signature;
  document.querySelector('#helpDevice').textContent=controller?'Connected controller · your current profile bindings':'Keyboard + mouse · your current profile bindings';
  const rows=controller?[
    ['Move / Aim','Left stick / Right stick'],
    ...Object.entries(PAD_ACTIONS).map(([key,[label]])=>[label,PAD_BUTTONS[settings.buttons[key]]]),
    ['Precision movement',`${PAD_BUTTONS[settings.buttons.shield]} + ${PAD_BUTTONS[settings.buttons.precision]}`],
  ]:[
    ['Move',['up','left','down','right'].map(k=>keyLabel(settings.keys[k])).join(' / ')+' or arrows'],
    ['Aim','Mouse or '+['aimUp','aimLeft','aimDown','aimRight'].map(k=>keyLabel(settings.keys[k])).join(' / ')],
    ...['fire','laser','shield','precision','pause'].map(key=>[KEY_ACTIONS[key][0],keyLabel(settings.keys[key])+(key==='fire'?' / left click / Enter':key==='laser'?' / right click':key==='pause'?' / Esc':'')]),
  ];
  const list=document.querySelector('#helpBindings');list.replaceChildren();
  for(const [label,value] of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;list.append(dt,dd);}
}
document.querySelector('#watchDemo').addEventListener('click',()=>{if(consumeDemo())return;demoEngine?.start();menuInput.reset();accumulator=0;previousTime=null;draw();document.querySelector('#stopDemo').focus();});
document.querySelector('#stopDemo').addEventListener('click',()=>consumeDemo());
document.querySelector('#retryRecords').addEventListener('click',()=>{runtime.records.save();draw();});
document.querySelector('#play').addEventListener('click',()=>{if(!consumeDemo())navigation?.start();});
document.querySelector('#resume').addEventListener('click',()=>navigation.resume());
document.querySelector('#quitRun').addEventListener('click',()=>navigation.request('home'));
document.querySelector('#gameHome').addEventListener('click',()=>navigation.request('home'));
document.querySelector('#screenBack').addEventListener('click',()=>navigation.back());
document.querySelector('#helpPractice').addEventListener('click',()=>navigation.start(true));
for(const button of document.querySelectorAll('[data-go]'))button.addEventListener('click',()=>navigate(button.dataset.go,button));
for(const button of document.querySelectorAll('[data-decision]'))button.addEventListener('click',()=>navigation.resolve(button.dataset.decision));
document.querySelector('#navigationDecision').addEventListener('cancel',event=>{event.preventDefault();navigation.resolve('stay');});
window.addEventListener('hashchange',()=>{
  if(!navigation)return;
  routeFromHistory=true;
  navigation.request(location.hash==='#play' && navigation.live?'pause':routeFromHash(location.hash));
  routeFromHistory=false;
});
window.addEventListener('beforeunload',event=>{if(navigation?.live){event.preventDefault();event.returnValue='';}});
new ResizeObserver(()=>fitCanvas()).observe(document.querySelector('.console'));
try {
  const response = await fetch('./game.wasm');
  if (!response.ok) throw new Error(`Game download failed (${response.status})`);
  const art=await loadArt(),bytes=await response.arrayBuffer();
  renderer = new PixelRenderer(canvas, art);
  demoEngine=await createDemo(bytes,new PixelRenderer(document.querySelector('#homeDemo'),art));
  document.querySelector('#watchDemo').disabled=false;
  runtime = await createRuntime(bytes, { storage, tone: setTone, scoreKey: 'asteroids.web.hd.scores-v3', profile: () => profileStore.activeProfile });
  navigation=new Navigation({runtime,dirty:()=>settingsDraft.changed(),apply:applyDraft,discard:()=>settingsDraft.discard(),changed:screenChanged});
  fireButton.disabled = false;document.querySelector('#play').disabled=false;
  persistSettings();
  window.asteroids = Object.freeze({ snapshot: () => runtime.snapshot(), state: () => runtime.state });
  navigation.request(routeFromHash(location.hash));
  fitCanvas(); draw(); requestAnimationFrame(frame);
} catch (error) {
  stateLabel.textContent = 'UNAVAILABLE';
  document.querySelector('#homeHint').textContent='Could not load the game. Reload to retry.';
  hint.textContent = 'Could not load the game. Serve web/dist over HTTP and reload.';
  console.error(error);
}
