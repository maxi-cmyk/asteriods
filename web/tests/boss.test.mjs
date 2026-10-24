import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRuntime} from '../runtime.mjs';
const bytes=await readFile(new URL('../dist/test.wasm',import.meta.url));
async function bossGame(players=1,health=0){
    const game=await createRuntime(bytes);
    game.start();game.api.web_scenario(0);game.api.web_test_boss(5,players,health);
    return game;
}
const ticks=(game,count,input={})=>{for(let i=0;i<count;i++)game.step(input);};

test('region-closing boss latches health scaling, suppresses rocks and pauses exactly',async()=>{
    const game=await bossGame(2);assert.equal(game.scene()[516],36);
    ticks(game,61);assert.equal(game.scene()[517],1);
    assert.equal(game.scene()[20],0);
    assert.equal([...game.scene().slice(64,256)].filter((v,i)=>i%8===0&&v).length,0);
    game.pause();const scene=[...game.scene().slice(512)],clock=game.scene()[2];ticks(game,500,{firePressed:true});
    assert.deepEqual([...game.scene().slice(512)],scene);assert.equal(game.scene()[2],clock);
    game.step({pause:true});assert.equal(game.scene()[521],2);
});

test('primary projectiles damage the core, award a boss once, then recover before wave progression',async()=>{
    const game=await bossGame(1,1);ticks(game,61);
    const before=game.scene()[16];game.step({firePressed:true,aimX:1});
    for(let i=0;i<50;i++)game.step({y:0});
    assert.equal(game.scene()[512],0);assert.equal(game.scene()[523],1);
    assert.equal(game.stats().hits,1);assert.equal(game.scene()[16]-before,1750);
    assert.equal(game.scene()[57],0);assert.equal(game.scene()[19],5);
    ticks(game,20);assert.equal(game.scene()[19],5);assert.equal(game.scene()[16]-before,1750);
    ticks(game,250);assert(game.scene()[19]>=6);
});

test('laser applies one 8-point hit, and telegraphed attacks leave a reachable dodge route',async()=>{
    const game=await bossGame();ticks(game,61);
    for(let i=0;i<76;i++){
        const scene=game.scene();
        const dx=414-scene[4],dy=135-scene[5],length=Math.hypot(dx,dy);
        game.step({y:0,laser:true,aimX:dx/length,aimY:dy/length});
    }
    assert.equal(game.state,'playing');assert.equal(game.scene()[7],3);
    assert.equal(game.scene()[515],10);assert.equal(game.stats().laserShots,1);
    ticks(game,15);assert.equal(game.scene()[515],10);
});

test('stored shield absorbs a boss lance and holds cannot cause repeated life loss',async()=>{
    const game=await bossGame();game.api.web_test_pickup(1);game.step({shield:true});
    ticks(game,122);
    assert.equal(game.scene()[7],3);assert.equal(game.scene()[15],0);
});

test('practice and a fresh retry do not inherit a previous boss',async()=>{
    const game=await bossGame();game.start(true);ticks(game,100);
    assert.equal(game.scene()[512],0);assert.equal(game.scene()[523],0);
    game.start();ticks(game,80);assert.equal(game.scene()[512],0);
});

test('multishot plus 2x fire keeps per-projectile accounting while damaging the boss core',async()=>{
    const game=await bossGame();ticks(game,61);
    game.api.web_test_pickup(0);game.step();
    game.api.web_test_pickup(2);game.step();
    game.step({firePressed:true,aimX:1});ticks(game,5);
    ticks(game,50,{y:0});
    assert.equal(game.stats().spawned,6);
    assert(game.stats().hits>=2);assert(game.stats().hits<=6);
    assert(game.scene()[515]<=16);assert.equal(game.scene()[523],0);
});
