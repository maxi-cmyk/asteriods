import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRuntime} from '../runtime.mjs';
import {Controls} from '../controls.mjs';
import {PersonalBests, RECORDS_KEY, rulesKey, accuracyText} from '../records.mjs';
const bytes=await readFile(new URL('../dist/test.wasm',import.meta.url));
const ticks=(g,n=1,input={})=>{for(let i=0;i<n;i++)g.step(input);};
async function game(scenario=9,options={}) {
  let seed=9317;
  const g=await createRuntime(bytes,{...options,random:()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0});
  g.api.web_scenario(scenario);return g;
}
const memory=()=>{const values=new Map();return {values,getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};};

test('2× pickup emits exactly two events 80ms apart; holds do not repeat or inflate CPS',async()=>{
  const g=await game(17);g.step({fire:true});
  assert.equal(g.stats().doubleFireMs,6000);assert.equal(g.stats().spawned,1);assert.equal(g.stats().pending,1);
  ticks(g,3,{fire:true});assert.equal(g.stats().spawned,1);
  g.step({fire:true});assert.equal(g.stats().spawned,2);assert.equal(g.stats().pending,0);
  ticks(g,45,{fire:true});assert.equal(g.stats().spawned,2);assert.equal(g.stats().cps,1);
  g.step({fire:true});assert.equal(g.stats().cps,0);assert.equal(g.stats().peakCps,1);
});

test('keyboard, mouse and controller primary edges produce identical boosted output',async()=>{
  for(const source of ['keyboard','mouse','controller']) {
    const g=await game(17),c=new Controls();
    const p={index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false}))};
    c.sample(source==='controller'?p:null);
    if(source==='keyboard')c.keyDown('Space');
    if(source==='mouse')c.pointerDown(0,1);
    if(source==='controller')p.buttons[7].pressed=true;
    for(let i=0;i<6;i++)g.step(c.sample(source==='controller'?p:null,2+i*20));
    assert.equal(g.stats().spawned,2,source);assert.equal(g.stats().presses,1,source);
    assert.equal(g.stats().peakCps,1,source);
  }
});

test('rapid presses keep bounded delayed events and count all spawned multishot projectiles',async()=>{
  const g=await game(18);
  ticks(g,20,{firePressed:true});
  assert.equal(g.stats().presses,20);assert.equal(g.stats().peakCps,20);
  assert(g.stats().pending<=4);assert(g.stats().spawned>=12);
  assert.equal(g.stats().spawned%3,0);assert(g.snapshot()[9]<=12);
  ticks(g,4);assert.equal(g.stats().pending,0);
});

test('full pools count no phantom shots; second events are dropped without retries',async()=>{
  const g=await game(16);g.api.web_test_pickup(2);
  g.step({firePressed:true});ticks(g,4);
  assert.equal(g.stats().spawned,0);assert.equal(g.stats().pending,0);
  assert.equal(g.fireDiagnostics()[2],2);assert.equal(accuracyText(g.stats().hits,g.stats().spawned),'—');
});

test('pickup refresh, expiry and pause preserve active time and earned delayed shots',async()=>{
  const g=await game(17);g.step();ticks(g,200);assert.equal(g.stats().doubleFireMs,2000);
  g.api.web_test_pickup(2);g.step();assert.equal(g.stats().doubleFireMs,6000);
  g.step({firePressed:true});g.step({pause:true});const frozen=g.stats();
  ticks(g,400,{firePressed:true});assert.deepEqual(g.stats(),frozen);
  g.step({pause:true});ticks(g,4);assert.equal(g.stats().spawned,2);
  ticks(g,294);assert.equal(g.stats().doubleFireMs,20);
  // The effect expires before input is processed on this tick.
  g.step({firePressed:true});assert.equal(g.stats().doubleFireMs,0);
  assert.equal(g.stats().pending,0);assert.equal(g.stats().spawned,3);
  ticks(g,5);assert.equal(g.stats().spawned,3);
});

test('a second event earned before expiry still fires after the timer reaches zero',async()=>{
  const g=await game(17);g.step();ticks(g,298);
  assert.equal(g.stats().doubleFireMs,40);
  g.step({firePressed:true});assert.equal(g.stats().doubleFireMs,20);
  ticks(g,4);assert.equal(g.stats().doubleFireMs,0);assert.equal(g.stats().spawned,2);
});

test('boosted multishot uses single-shot fallback for each event with limited slots',async()=>{
  const g=await game(15);g.api.web_test_pickup(2);g.step({firePressed:true});ticks(g,4);
  assert.equal(g.stats().spawned,2);assert.equal(g.snapshot()[9],12);
});

test('death cancels effect and delayed events; a new run and leaving play reset them',async()=>{
  const g=await game(17);g.step({firePressed:true});g.api.web_test_overlap();g.step();
  assert.equal(g.state,'death');assert.equal(g.stats().doubleFireMs,0);assert.equal(g.stats().pending,0);
  ticks(g,30);assert.equal(g.stats().spawned,1);
  g.start(true);g.doubleFire();g.step({firePressed:true});g.menu();
  assert.equal(g.stats().pending,0);assert.equal(g.stats().doubleFireMs,0);
  g.start();assert.equal(g.stats().spawned,0);assert.equal(g.stats().peakCps,0);
});

test('each enemy-hit projectile counts once and misses remain in the denominator',async()=>{
  const g=await game(19);g.step({firePressed:true});ticks(g,4);
  assert.equal(g.stats().spawned,1);assert.equal(g.stats().hits,1);
  ticks(g,10);assert.equal(g.stats().hits,1);
  g.step({firePressed:true,aimY:-1});ticks(g,10);
  assert.equal(g.stats().spawned,2);assert.equal(g.stats().hits,1);
  assert.equal(accuracyText(g.stats().hits,g.stats().spawned),'50.0% (1/2)');
});

test('laser stats are separate; longest chain keeps growing beyond the multiplier cap',async()=>{
  const g=await game(14);g.step({laser:true});ticks(g,75,{laser:true});
  assert.equal(g.stats().laserShots,1);assert.equal(g.stats().laserKills,24);
  assert.equal(g.stats().longestChain,24);assert.equal(g.scene()[17],5);
  assert.equal(g.stats().hits,0);assert.equal(g.stats().spawned,0);
  ticks(g,160);assert.equal(g.scene()[17],1);assert.equal(g.stats().longestChain,24);
});

test('laser windup suppresses both primary events without changing laser behavior',async()=>{
  const g=await game(17);g.step({firePressed:true});
  ticks(g,4,{laser:true});assert.equal(g.stats().spawned,1);assert.equal(g.stats().pending,0);
  assert.equal(g.fireDiagnostics()[3],1);assert.equal(g.scene()[47],1);
});

test('records isolate profiles, modes, friendly fire, modifiers and practice and reload safely',()=>{
  const storage=memory(),pb=new PersonalBests(storage);
  const run={score:500,wave:3,peakCps:9,longestChain:17,hits:40,shots:50};
  pb.record(0,{},run);
  assert.equal(new PersonalBests(storage).get(0,{}).accuracy.shots,50);
  for(const rules of [{mode:'co-op'},{mode:'versus'},{friendlyFire:true},{practice:true},{modifiers:['one-life']}])assert.equal(pb.get(0,rules),null);
  assert.equal(pb.get(1,{}),null);
  assert.equal(rulesKey({modifiers:['one-life','fast','fast']}),rulesKey({modifiers:['fast','one-life']}));
  pb.record(0,{}, {...run,score:100,hits:1,shots:1});assert.equal(pb.get(0,{}).accuracy.hits,40);
  pb.record(0,{}, {...run,hits:49,shots:50});assert.equal(pb.get(0,{}).accuracy.hits,49);
  storage.setItem('asteroids.web.hd.scores-v3','original');pb.reset(0);
  assert.equal(new PersonalBests(storage).get(0,{}),null);assert.equal(storage.getItem('asteroids.web.hd.scores-v3'),'original');
});

test('invalid data and storage failures keep usable visit records and report failure',()=>{
  for(const raw of ['null','{}','not-json',JSON.stringify({version:99,profiles:[{},{}]})]) {
    const storage=memory();storage.setItem(RECORDS_KEY,raw);const pb=new PersonalBests(storage);
    assert.equal(pb.get(0,{}),null);assert.match(pb.status,/could not be read/);
  }
  const pb=new PersonalBests({getItem(){throw Error('blocked');},setItem(){throw Error('full');}});
  pb.record(0,{}, {score:1,wave:1,peakCps:1,longestChain:1,hits:1,shots:1});
  assert.equal(pb.get(0,{}).score,1);assert.equal(pb.get(0,{}).accuracy,null);assert.match(pb.status,/Could not save/);
  assert.throws(()=>pb.record(0,{}, {score:NaN}),TypeError);
});

test('run profile is locked; final in-flight shots are included and records save exactly once',async()=>{
  let profile=0,writes=0;const storage=memory();const setItem=storage.setItem;
  storage.setItem=(key,value)=>{if(key===RECORDS_KEY)writes++;setItem(key,value);};
  const g=await game(9,{storage,profile:()=>profile});g.start();g.api.web_scenario(3);
  profile=1;g.step({firePressed:true,aimY:-1});
  assert.equal(g.result.profile,0);assert.equal(g.result.shots,1);assert.equal(g.result.hits,0);
  assert.equal(g.records.get(0,{}).score,1234);assert.equal(g.records.get(1,{}),null);
  ticks(g,30,{firePressed:true});assert.equal(writes,1);assert.equal(g.result.shots,1);
  g.start(true);assert.equal(g.runProfile,1);g.doubleFire();g.step({firePressed:true});g.menu();
  assert.equal(g.result.rules.practice,true);assert.equal(g.records.get(1,{practice:true}).peakCps,1);
  const result=structuredClone(g.result);ticks(g,2000);g.step({fire:true});
  assert.deepEqual(g.result,result);
});

test('results precede score entry, freeze the run, and consume held/continue fire before saving',async()=>{
  const storage=memory();let scoreWrites=0;const save=storage.setItem;
  storage.setItem=(key,value)=>{if(key!==RECORDS_KEY)scoreWrites++;save(key,value);};
  const g=await game(9,{storage});g.start();g.api.web_scenario(3);
  g.step({fire:true});ticks(g,25,{fire:true});assert.equal(g.state,'results');
  const scene=[...g.scene()],summary=structuredClone(g.result);
  ticks(g,100,{fire:true,x:4095});
  assert.equal(g.state,'results');assert.equal(scoreWrites,0);
  assert.deepEqual([...g.scene()],scene);assert.deepEqual(g.result,summary);
  g.step();g.step({fire:true});assert.equal(g.state,'initials');
  ticks(g,10,{fire:true});assert.equal(scoreWrites,0);assert.equal(g.state,'initials');
  g.step();g.step({fire:true});assert.equal(scoreWrites,1);assert.equal(g.state,'game-over');
  ticks(g,3,{fire:true});assert.equal(g.state,'game-over');
});

test('non-qualifying runs show results before leaderboard; button Continue never restarts play',async()=>{
  const g=await game();g.start();g.api.web_scenario(9);
  for(let life=0;life<3;life++) {g.api.web_test_overlap();g.step();ticks(g,25);}
  assert.equal(g.state,'results');assert.equal(g.result.score,0);
  g.continueResults();assert.equal(g.state,'game-over');
  ticks(g,5,{fire:true});assert.equal(g.state,'game-over');
  ticks(g,50);g.step({fire:true});assert.equal(g.state,'countdown');
});

test('practice results wait inside the game area without starting an idle demo',async()=>{
  const g=await game();g.start(true);g.step({firePressed:true});g.menu();
  assert.equal(g.state,'results');assert(g.result.rules.practice);
  const frozen=[...g.scene()];ticks(g,3000);assert.deepEqual([...g.scene()],frozen);
  g.continueResults();assert.equal(g.state,'menu');
});
