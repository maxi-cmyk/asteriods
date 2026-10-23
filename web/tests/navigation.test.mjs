import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Navigation, MenuInput, routeFromHash, fitPlayfield} from '../navigation.mjs';
import {createRuntime} from '../runtime.mjs';
const bytes=await readFile(new URL('../dist/test.wasm',import.meta.url));
async function setup(options={}) {
  let seed=9317;
  const runtime=await createRuntime(bytes,{random:()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0});
  return {runtime,nav:new Navigation({runtime,...options})};
}

test('stable utility links restore only utility destinations; live and invalid links restore Home',()=>{
  for(const screen of ['records','settings','help','developer'])assert.equal(routeFromHash(`#${screen}`),screen);
  for(const hash of ['#play','#pause','#results','#warp','#unknown',''])assert.equal(routeFromHash(hash),'home');
});

test('Pause → Settings/Help → Back retains exact runtime snapshot, bullets and effect deadlines',async()=>{
  const {runtime,nav}=await setup();nav.start(true);runtime.doubleFire();runtime.multishot();
  runtime.step({firePressed:true});nav.pause();
  const snapshot=runtime.snapshot(),scene=[...runtime.scene()],stats=runtime.stats();
  for(const target of ['settings','help','developer']) {
    nav.request(target);assert.equal(nav.screen,target);assert.equal(nav.origin,'pause');
    assert.equal(nav.shouldStep,false);
    for(let i=0;i<500;i++)if(nav.shouldStep)runtime.step();
    nav.back();assert.equal(nav.screen,'pause');
    assert.deepEqual(runtime.snapshot(),snapshot);assert.deepEqual([...runtime.scene()],scene);assert.deepEqual(runtime.stats(),stats);
  }
  nav.resume();assert.equal(nav.screen,'play');assert.equal(runtime.state,'playing');
  assert.equal(runtime.snapshot()[5],snapshot[5]);assert.equal(runtime.stats().spawned,stats.spawned);
});

test('Home and utilities never clock the player runtime or start an idle demo',async()=>{
  const {runtime,nav}=await setup();nav.request('records');
  for(let i=0;i<2000;i++)if(nav.shouldStep)runtime.step();
  assert.equal(runtime.state,'menu');nav.back();assert.equal(nav.screen,'home');
  for(let i=0;i<1800 && runtime.state!=='demo';i++)if(nav.shouldStep)runtime.step();
  assert.equal(nav.shouldStep,false);assert.equal(runtime.state,'menu');
  nav.request('help');assert.equal(nav.shouldStep,false);
});

test('navigation to Home pauses an active run and requires explicit quit; Stay keeps the same run',async()=>{
  const {runtime,nav}=await setup();nav.start(true);runtime.step({firePressed:true});
  nav.request('home');assert.equal(nav.screen,'pause');assert.equal(nav.pending.kind,'quit');
  const snapshot=runtime.snapshot();nav.resolve('stay');assert.equal(nav.pending,null);assert.deepEqual(runtime.snapshot(),snapshot);
  nav.request('home');nav.resolve('quit');assert.equal(nav.screen,'home');assert.equal(runtime.state,'menu');assert.equal(runtime.result,null);
});

test('settings Back requires explicit Apply/Discard/Stay; applying does not resume gameplay',async()=>{
  let dirty=true,applied=0,discarded=0;
  const {runtime,nav}=await setup({dirty:()=>dirty,apply:()=>{applied++;dirty=false;},discard:()=>{discarded++;dirty=false;}});
  nav.start(true);nav.pause();nav.request('settings');nav.back();
  assert.equal(nav.pending.kind,'draft');assert.equal(nav.screen,'settings');nav.resolve('stay');assert.equal(nav.screen,'settings');
  nav.back();nav.resolve('apply');assert.equal(applied,1);assert.equal(discarded,0);assert.equal(nav.screen,'pause');assert.equal(runtime.state,'paused');
  nav.request('settings');dirty=true;nav.back();nav.resolve('discard');assert.equal(discarded,1);assert.equal(nav.screen,'pause');
});

test('history navigation through dirty settings to Home still asks before abandoning the paused run',async()=>{
  let dirty=true;
  const {runtime,nav}=await setup({dirty:()=>dirty,discard:()=>{dirty=false;}});
  nav.start();nav.request('settings');nav.request('home');assert.equal(nav.pending.kind,'draft');
  nav.resolve('discard');assert.equal(nav.pending.kind,'quit');assert.equal(nav.screen,'pause');
  nav.resolve('stay');assert.equal(runtime.state,'countdown');assert.equal(nav.shouldStep,false);
  nav.resume();assert.equal(runtime.state,'countdown');assert.equal(nav.screen,'play');
});

test('new Play is one action, practice uses the same focused play destination, and abandon does not save practice',async()=>{
  const {runtime,nav}=await setup();nav.start();assert.equal(nav.screen,'play');assert.equal(runtime.state,'countdown');
  runtime.abandon();nav.set('home');nav.start(true);assert.equal(runtime.state,'playing');
  nav.request('home');nav.resolve('quit');assert.equal(runtime.records.get(0,{practice:true}),null);
  assert.equal(runtime.stats().pending,0);
});

test('field sizing preserves 16:9 and fits wide or short containers without negative dimensions',()=>{
  for(const [w,h] of [[1440,720],[960,330],[400,200],[1920,1080],[0,100],[100,-5]]) {
    const size=fitPlayfield(w,h);assert(size.width>=0);assert(size.height>=0);
    assert(size.width<=Math.max(0,w));assert(size.height<=Math.max(0,h));
    assert(Math.abs(size.width-size.height*16/9)<1e-8);
  }
});

test('controller menu entry rejects held confirm/reconnect; navigation repeats but confirms fire once',()=>{
  const input=new MenuInput();
  const pad={buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};
  pad.buttons[0].pressed=true;assert.deepEqual(input.sample(pad,0),{});assert.deepEqual(input.sample(pad,100),{});
  pad.buttons[0].pressed=false;input.sample(pad,110);pad.buttons[0].pressed=true;assert(input.sample(pad,120).confirm);assert(!input.sample(pad,140).confirm);
  input.reset();assert.deepEqual(input.sample(pad,160),{});pad.buttons[0].pressed=false;input.sample(pad,180);
  pad.axes[1]=1;assert.equal(input.sample(pad,200).direction,1);assert(!input.sample(pad,400).direction);assert.equal(input.sample(pad,550).direction,1);
});


test('controller pause resumes only after release and honors the configured button',()=>{
  const input=new MenuInput();
  const pad={buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};
  pad.buttons[8].pressed=true;assert.deepEqual(input.sample(pad,0,8),{});
  pad.buttons[8].pressed=false;input.sample(pad,10,8);
  pad.buttons[8].pressed=true;assert.equal(input.sample(pad,20,8).pause,true);
  assert.equal(input.sample(pad,30,8).pause,undefined);
});


test('leaving results or unsaved initials requires an explicit choice and Stay preserves the score step',async()=>{
  const {runtime,nav}=await setup();nav.start();runtime.api.web_scenario(3);
  runtime.step();for(let i=0;i<25;i++)runtime.step();assert.equal(runtime.state,'results');
  nav.request('home');assert.equal(nav.pending.kind,'quit');nav.resolve('stay');assert.equal(runtime.state,'results');
  runtime.continueResults();assert.equal(runtime.state,'initials');
  const scene=[...runtime.scene()];nav.request('home');nav.resolve('stay');assert.deepEqual([...runtime.scene()],scene);
  nav.request('home');nav.resolve('quit');assert.equal(nav.screen,'home');assert.equal(runtime.state,'menu');
});
