import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRuntime} from '../runtime.mjs';
import {GameAudio} from '../audio.mjs';
import {Controls,radial} from '../controls.mjs';
import {defaults,loadSettings,saveSettings,SETTINGS_KEY,sanitizeSettings} from '../settings.mjs';
const bytes=await readFile(new URL('../dist/test.wasm',import.meta.url));
const ticks=(g,n=1,input={})=>{for(let i=0;i<n;i++)g.step(input);};
const pad=()=>({connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false}))});
async function game(storage) { let seed=9317;return createRuntime(bytes,{storage,random:()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0}); }

test('saved settings validate corrupt data, preserve zero values, and survive reload',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const settings=defaults();settings.volume=0;settings.shake=0;settings.deadzone=.12;settings.keys.fire='KeyZ';settings.buttons.fire=2;
  assert(saveSettings(storage,settings));assert.deepEqual(loadSettings(storage),settings);
  values.set(SETTINGS_KEY,'not-json');assert.deepEqual(loadSettings(storage),defaults());
  values.set(SETTINGS_KEY,'null');assert.deepEqual(loadSettings(storage),defaults());
  const cleaned=sanitizeSettings({volume:12,deadzone:-1,keys:{fire:'Escape'},buttons:{fire:99}});
  assert.equal(cleaned.volume,1);assert.equal(cleaned.deadzone,.05);assert.equal(cleaned.keys.fire,'Space');assert.equal(cleaned.buttons.fire,7);
  assert.equal(saveSettings({setItem(){throw Error('blocked');}},settings),false);
});

test('mouse clicks survive a quick release; held laser cancels and clear releases both buttons',()=>{
  const c=new Controls(defaults());c.pointerDown(0,10);c.pointerUp(0);
  assert(c.sample(null,20).fire);assert(c.sample(null,71).fire===false);
  c.pointerDown(2);assert(c.sample(null).laser);c.pointerUp(2);assert(!c.sample(null).laser);
  c.pointerDown(0);c.pointerDown(2);c.clear();const input=c.sample(null,100);assert(!input.fire && !input.laser);
});

test('keyboard and gamepad remaps drive actual actions, with reserved navigation available',()=>{
  const settings=defaults();settings.keys.fire='KeyZ';settings.keys.laser='KeyX';settings.keys.shield='KeyV';settings.keys.pause='KeyB';
  settings.buttons.fire=2;settings.buttons.laser=3;settings.buttons.shield=0;settings.buttons.precision=1;settings.buttons.pause=8;
  const c=new Controls(settings);c.keyDown('Space');assert(!c.sample(null).fire);c.keyDown('KeyZ');assert(c.sample(null).fire);
  c.clear();c.keyDown('KeyX');assert(c.sample(null).laser);c.keyUp('KeyX');
  c.keyDown('KeyV');assert(!c.sample(null).shield);c.keyUp('KeyV');assert(c.sample(null).shield);
  c.keyDown('KeyB');assert(c.sample(null).pause);assert(!c.sample(null).pause);
  c.clear();c.keyDown('Escape');assert(c.sample(null).pause);c.keyDown('Enter');assert(c.sample(null).fire);
  c.clear();const p=pad();p.buttons[2].pressed=true;p.buttons[3].pressed=true;p.buttons[8].pressed=true;
  const i=c.sample(p);assert(i.fire && i.laser && i.pause);assert(!c.sample(p).pause);
  c.clear();settings.buttons.fire=10;p.buttons[10].pressed=true;const remapped=c.sample(p);assert(remapped.fire && !remapped.click);
});

test('deadzone removes drift and aim response changes turning speed without slowing movement',()=>{
  assert.deepEqual(radial(.1,.1,.25),[0,0]);assert.deepEqual(radial(1,0,.25),[1,0]);
  const settings=defaults(),c=new Controls(settings),p=pad();p.axes[0]=.2;assert.equal(c.sample(p).x,2048);
  settings.deadzone=.1;assert(c.sample(p).x>2048);
  const slow=new Controls({...defaults(),aimSensitivity:.25}),fast=new Controls({...defaults(),aimSensitivity:2});
  slow.aimAt(10,0);fast.aimAt(10,0);slow.sample(null);fast.sample(null);
  slow.aimAt(0,10);fast.aimAt(0,10);
  assert(slow.sample(null).aimY<fast.sample(null).aimY);
});

test('practice offers replenishing targets and shields, unlimited lives, and no leaderboard writes',async()=>{
  let writes=0;const g=await game({getItem:()=>null,setItem:()=>writes++});
  g.start(true);assert.equal(g.state,'playing');assert.equal(g.scene()[60],1);assert.equal(g.snapshot()[10],3);assert.equal(g.scene()[55],1);
  g.api.web_test_overlap();g.step();assert.equal(g.state,'playing');assert.equal(g.snapshot()[3],3);
  g.step({shield:true});assert.equal(g.scene()[62]&16,16);assert.equal(g.snapshot()[3],3);
  g.multishot();ticks(g,2,{fire:true});assert.equal(g.snapshot()[9],3);
  g.step({x:4095,aimY:1});assert.equal(g.scene()[62]&7,7);
  g.resetTargets();assert.equal(g.snapshot()[10],3);
  g.api.web_scenario(14);g.step({laser:true});ticks(g,150,{laser:true});
  assert.equal(g.snapshot()[10],0);assert.equal(g.scene()[62]&8,8);
  ticks(g,76);assert.equal(g.snapshot()[10],3);
  g.menu();assert.equal(g.state,'menu');assert.equal(g.scene()[60],0);assert.equal(writes,0);
  g.start(false);assert.equal(g.state,'countdown');assert.equal(g.snapshot()[4],0);assert.equal(g.scene()[57],0);
});

test('laser destructions update actual run counts and multiplier peaks survive expiry and death',async()=>{
  const g=await game();g.api.web_scenario(14);
  g.step({laser:true});ticks(g,150,{laser:true});
  assert.equal(g.scene()[57],24);assert.equal(g.scene()[58],5);
  ticks(g,160);assert.equal(g.scene()[17],1);assert.equal(g.scene()[58],5);
  g.api.web_test_overlap();g.step();const count=g.scene()[57],time=g.scene()[2];
  ticks(g,25);assert.equal(g.scene()[57],count);assert.equal(g.scene()[58],5);assert.equal(g.scene()[2],time);
  g.start(false);assert.equal(g.scene()[57],0);assert.equal(g.scene()[58],1);
});

test('laser audio cues follow discharge and cooldown completion, ignoring paused frames',()=>{
  const audio=new GameAudio(defaults()),events=[];audio.cue=kind=>events.push(kind);
  const scene=new Float32Array(512);scene[0]=2;scene[2]=20;audio.observe(scene);
  scene[2]=40;scene[49]=7000;scene[50]=400;audio.observe(scene);
  scene[2]=60;scene[49]=20;scene[50]=0;audio.observe(scene);
  scene[0]=3;audio.observe(scene);assert.deepEqual(events,['discharge']);
  scene[0]=2;scene[2]=80;scene[49]=0;audio.observe(scene);
  audio.observe(scene);assert.deepEqual(events,['discharge','ready']);
});
