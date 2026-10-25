import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRuntime} from '../runtime.mjs';
import {CoopLeaderboard,COOP_SCORE_KEYS} from '../coop-records.mjs';
const bytes=await readFile(new URL('../dist/test.wasm',import.meta.url));
const ticks=(g,n,input={})=>{for(let i=0;i<n;i++)g.step(input);};
async function game(friendlyFire=false,storage) {
    let seed=1987;
    const g=await createRuntime(bytes,{storage,random:()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0});
    g.startCoop({friendlyFire});g.api.web_test_coop(0,0,0);return g;
}
const set=(g,p,f,v)=>g.api.web_test_coop(p,f,v);
const players=g=>g.coopPlayers();
const memory=()=>{const values=new Map();return {values,getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('two-player input, shot ownership, caps and timers remain independent',async()=>{
    const g=await game();
    for(let p=0;p<2;p++){set(g,p,5,6000);set(g,p,6,6000);}
    ticks(g,5,{players:[{firePressed:true,aimX:1,x:4095},{firePressed:true,aimX:1,x:0}]});
    const [a,b]=players(g);
    assert(a.x>45);assert(b.x<45);assert.equal(a.stats.spawned,b.stats.spawned);
    assert(a.stats.spawned>=12);assert(a.stats.pending<=4);
    for(const p of [a,b]) assert([...p.scene.slice(256,328)].filter((v,i)=>i%6===0&&v).length<=12);
    const before=players(g).map(p=>[...p.scene]);g.pause();ticks(g,200);
    assert.deepEqual(players(g).map(p=>[...p.scene].filter((_,i)=>![0,1,3].includes(i))),before.map(p=>p.filter((_,i)=>![0,1,3].includes(i))));
});
test('friendly fire intercepts a high speed bullet before a farther rock, off passes through',async()=>{
    for(const friendly of [true,false]) {
        const g=await game(friendly);set(g,0,1,100);set(g,1,1,150);set(g,1,2,95);set(g,1,3,0);
        set(g,0,10,200);g.step({players:[{firePressed:true,aimX:1},{}]});ticks(g,6);
        const [a,b]=players(g);
        assert.equal(b.lives,friendly?2:3);assert.equal(a.stats.hits,friendly?0:1);
        assert.equal(a.score,friendly?0:100);
    }
});
test('death clears only victim state, world continues, respawn uses active time',async()=>{
    const g=await game();g.step({players:[{firePressed:true,aimX:1},{firePressed:true,aimX:1}]});
    set(g,0,3,0);set(g,0,7,0);const old=players(g);
    assert.equal(old[0].alive,false);assert.equal(old[1].scene[256],1);
    ticks(g,24);assert.equal(players(g)[0].alive,false);g.pause();ticks(g,100);assert.equal(players(g)[0].alive,false);
    g.step({pause:true});g.step();assert.equal(players(g)[0].alive,true);assert(players(g)[0].scene[8]>0);
    assert.equal(players(g)[0].stats.spawned,1);
});
test('simultaneous pickup has one collector and only one world drift',async()=>{
    const g=await game();set(g,1,2,95);set(g,0,9,2);g.step();
    const ps=players(g);assert.equal(ps.filter(p=>p.stats.doubleFireMs>0).length,1);
    assert.equal(ps.reduce((n,p)=>n+p.stats.doubleFireMs,0),6000);
    ticks(g,1);assert.equal(players(g).reduce((n,p)=>n+p.stats.doubleFireMs,0),5980);
});
test('both last lives end once, co-op personal bests and team saving are isolated',async()=>{
    const store=memory(),g=await game(false,store);
    set(g,0,10,85);g.step({players:[{firePressed:true,aimX:1},{}]});ticks(g,3);
    for(let p=0;p<2;p++){set(g,p,3,0);set(g,p,4,1);set(g,p,7,0);}
    g.step();assert.equal(g.state,'results');assert.equal(g.result.players.length,2);
    assert.equal(g.result.score,100);assert.equal(g.records.get(0,{mode:'solo'}),null);
    g.continueResults();assert.equal(g.state,'initials');g.step();g.step({firePressed:true});
    assert.equal(g.state,'game-over');assert.equal(g.teamEntries.length,1);
    g.step({firePressed:true});assert.equal(g.teamEntries.length,1);
    assert.equal(store.values.has('asteroids.web.scores-v3'),false);
});
test('team leaderboards isolate friendly fire and retry without duplicate writes',()=>{
    const store=memory(),board=new CoopLeaderboard(store,false),id=Symbol();
    assert.equal(board.save(id,'AAA',1999998),true);assert.equal(board.save(id,'AAA',1999998),true);
    assert.equal(board.entries.length,1);assert.equal(new CoopLeaderboard(store,true).entries.length,0);
    assert(store.values.has(COOP_SCORE_KEYS[0]));
    const fail=new CoopLeaderboard({setItem(){throw Error();}},false);
    assert.equal(fail.save(id,'AAA',100),false);assert.equal(fail.entries.length,0);
});

test('boss roster, alternating target locks, attribution and piercing laser apply once',async()=>{
    const g=await game();
    set(g,0,1,100);set(g,0,2,135);set(g,1,1,170);set(g,1,2,210);
    for(let p=0;p<2;p++)set(g,p,3,100000);
    g.api.web_test_boss(5,2,36);ticks(g,60);
    let scene=players(g)[0].scene;
    assert.equal(scene[516],36);assert.equal(scene[521],2);assert.equal(scene[524],100);
    ticks(g,76,{players:[{laser:true,aimX:1},{}]});
    assert.equal(players(g)[0].scene[515],28);assert.equal(players(g)[0].stats.laserShots,1);
    ticks(g,20,{players:[{laser:true,aimX:1},{}]});assert.equal(players(g)[0].scene[515],28);
    ticks(g,20);scene=players(g)[0].scene;
    assert.equal(scene[524],170);assert.equal(scene[519],210);
    set(g,1,3,0);set(g,1,7,0);assert.equal(players(g)[0].scene[516],36);
});
test('same-target simultaneous shots pay once and the loser continues without duplicate credit',async()=>{
    const g=await game();set(g,1,2,95);set(g,0,10,110);
    g.step({players:[{firePressed:true,aimX:1},{firePressed:true,aimX:1}]});ticks(g,4);
    const ps=players(g);
    assert.equal(ps.reduce((n,p)=>n+p.score,0),100);
    assert.equal(ps.reduce((n,p)=>n+p.stats.hits,0),1);
    assert.equal(ps[0].teamScore,100);
});
test('friendly laser uses shield/protection, no enemy accuracy and no repeat damage from visual',async()=>{
    const g=await game(true);set(g,0,1,100);set(g,1,1,200);set(g,1,2,95);
    set(g,1,3,0);set(g,1,8,1);
    g.step({players:[{}, {shield:true}]});
    ticks(g,76,{players:[{laser:true,aimX:1},{}]});
    const ps=players(g);assert.equal(ps[1].lives,3);assert.equal(ps[1].shield,'EMPTY');
    assert.equal(ps[0].score,0);assert.equal(ps[0].stats.hits,0);
    ticks(g,50,{players:[{laser:true,aimX:1},{}]});assert.equal(players(g)[1].lives,3);
});
test('countdown pause retains elapsed time and paused laser release cancels windup',async()=>{
    const g=await game();g.startCoop();ticks(g,20);g.pause();ticks(g,200);
    assert.equal(g.state,'paused');g.step({pause:true});ticks(g,54);assert.equal(g.state,'countdown');g.step();assert.equal(g.state,'playing');
    ticks(g,15,{players:[{laser:true,aimX:1},{}]});assert(players(g)[0].charging);
    g.pause();g.releaseCoopLasers([{},{}]);g.step({pause:true});g.step();assert.equal(players(g)[0].charging,false);
});
test('sustained dual multishot/echo load stays bounded over ten thousand ticks',async()=>{
    const g=await game();for(let p=0;p<2;p++){set(g,p,3,1000000);set(g,p,5,1000000);set(g,p,6,1000000);}
    for(let i=0;i<10000;i++) {
        const angle=i*.03;
        g.step({players:[{firePressed:true,aimX:Math.cos(angle),aimY:Math.sin(angle)}, {firePressed:true,aimX:-Math.cos(angle),aimY:-Math.sin(angle)}]});
        if(i%100===0)for(const p of players(g)) {
            assert(p.stats.pending<=4);assert(p.stats.hits<=p.stats.spawned);
            assert([...p.scene.slice(256,328)].filter((v,j)=>j%6===0&&v).length<=12);
        }
    }
    assert.equal(g.state,'playing');assert.equal(players(g)[0].scene[2],200000);
});

test('co-op reset clears both team contexts and personal bests while preserving settings',async()=>{
    const store=memory(),g=await game(false,store);
    for(const friendly of [false,true])new CoopLeaderboard(store,friendly).save(Symbol(),'AAA',123);
    store.setItem('asteroids.web.settings-v1','unchanged');
    assert(g.clearRecords());
    for(const friendly of [false,true])assert.equal(new CoopLeaderboard(store,friendly).entries.length,0);
    assert.equal(store.getItem('asteroids.web.settings-v1'),'unchanged');
});
test('team storage corruption and ties stay bounded; duplicate profiles cannot start',async()=>{
    const store=memory();store.setItem(COOP_SCORE_KEYS[0],'{broken');
    let board=new CoopLeaderboard(store,false);assert.equal(board.entries.length,0);assert.match(board.status,/could not be read/);
    for(let i=0;i<5;i++)board.save(Symbol(),'AAA',100);
    assert(!board.qualifies(100));assert(board.qualifies(101));assert(!board.qualifies(0));
    const g=await game();assert.throws(()=>g.startCoop({profiles:[0,0]}));
});
test('a protected teammate still intercepts a shot; shield consumption never adds enemy credit',async()=>{
    for(const shield of [false,true]) {
        const g=await game(true);set(g,0,1,100);set(g,1,1,150);set(g,1,2,95);
        if(shield){set(g,1,3,0);set(g,1,8,1);g.step({players:[{},{shield:true}]});}
        set(g,0,10,200);g.step({players:[{firePressed:true,aimX:1},{}]});ticks(g,6);
        const [a,b]=players(g);assert.equal(b.lives,3);assert.equal(a.stats.hits,0);assert.equal(a.score,0);
        if(shield)assert.equal(b.shield,'EMPTY');
    }
});
