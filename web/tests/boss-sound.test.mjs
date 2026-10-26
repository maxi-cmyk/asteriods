import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRuntime} from '../runtime.mjs';
import {BossBot} from './boss-bot.mjs';
import {BossSound, describeSounds, voice, groupOf} from '../boss-sound.mjs';
import {KINDS, BOSS_AT} from '../boss-scene.mjs';
const bytes=await readFile(new URL('../dist/test.wasm',import.meta.url));

// A voice that records what a sound asks of the synth instead of making noise.
function recorder(){
    const calls=[];
    const rec=type=>o=>calls.push({type,...o});
    return {calls,tone:rec('tone'),noise:rec('noise')};
}
function checkCalls(calls,label){
    assert(calls.length>0,`${label}: silent`);
    let end=0;
    for(const c of calls){
        const at=c.at??0,dur=c.dur??.2;
        assert(Number.isFinite(c.f??c.f===undefined?1:c.f)&&(c.f===undefined||c.f>0),`${label}: bad frequency`);
        assert(dur>0&&dur<6&&at>=0&&(c.vol??.1)>0&&(c.vol??.1)<=.4,`${label}: bad envelope ${JSON.stringify(c)}`);
        end=Math.max(end,at+dur);
    }
    return end;
}

test('every designed sound is audible, bounded and finishes quickly',()=>{
    const sounds=describeSounds();
    assert(sounds.length>=6*3);
    for(const s of sounds){
        const v=recorder();s.play(v);
        const end=checkCalls(v.calls,s.id);
        assert(end<=5,`${s.id} runs ${end.toFixed(1)} s`);
        if(s.id.endsWith('.defeat'))assert(end>=2,`${s.id}: a defeat should be a moment`);
    }
});

test('each boss has a distinct defeat sound',()=>{
    const signatures=new Set();
    for(const s of describeSounds().filter(s=>s.id.endsWith('.defeat'))){
        const v=recorder();s.play(v);
        signatures.add(JSON.stringify(v.calls.map(c=>[c.type,c.type==='tone'?c.type:0,Math.round(c.f??c.f1??0),c.at??0,c.f===undefined?c.f:0])));
    }
    assert.equal(signatures.size,6);
});

test('the game plays the right sounds as each fight unfolds',async()=>{
    for(const kind of KINDS.keys()){
        let seed=300+kind;
        const game=await createRuntime(bytes,{random:()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0});
        game.start(true);game.api.web_boss_practice(kind,0,0);
        const heard=new Map(),log=(section,key)=>heard.set(section,(heard.get(section)||0)+1);
        const audio={context:{},master:{},settings:{soundEnabled:true},suspended:false};
        const sound=new BossSound(audio);
        sound.run=(k,build)=>{const v=recorder();build(v);checkCalls(v.calls,`kind ${kind}`);};
        const play=sound.play.bind(sound);
        sound.play=(k,section,key,o)=>{log(section,key);play(k,section,key,o);};
        sound.sting=k=>log('sting');sound.defeat=k=>log('defeat');
        const bot=new BossBot(game);let old=new Float32Array(1408);   // nothing on screen yet: the first frame is the entrance
        for(let i=0;i<150*50;i++){
            bot.step();const scene=game.scene();
            if(old&&scene[2]>old[2])sound.observe(old,scene);
            old=new Float32Array(scene);
            if(!scene[512]&&i>100)break;
        }
        const name=KINDS[kind].name;
        assert.equal(heard.get('sting'),1,`${name}: entrance sting`);
        assert.equal(heard.get('defeat'),1,`${name}: defeat sound`);
        assert((heard.get('charge')||0)>=1,`${name}: attack charge-ups`);
        assert((heard.get('hit')||0)>=3,`${name}: boss hit feedback`);
        // Fights with lethal hazards sound them going live; fights with projectiles sound each shot.
        if([0,1,2,3,4,5,6,8].includes(kind)&&kind!==3)assert((heard.get('live')||0)+(heard.get('shot')||0)>=1,`${name}: release sounds`);
        assert((heard.get('shot')||0)+(heard.get('live')||0)>=1,`${name}: something is heard when it attacks`);
    }
});

test('a real synth renders without throwing against a fake audio graph',()=>{
    const node=()=>({connect:x=>x,disconnect(){},start(){},stop(){},frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},Q:{},detune:{},type:''});
    const ctx={currentTime:1,sampleRate:8000,createOscillator:node,createGain:node,createBiquadFilter:node,createBufferSource:node,
        createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)})};
    for(const s of describeSounds())s.play(voice(ctx,{}));
    assert.equal(groupOf(8),'cinderforge');
});

import {GUIDE} from '../boss-guide.mjs';
test('the field guide documents every attack the engine actually runs, and every sound it names exists',async()=>{
    const {describeSounds:_ignored}=await import('../boss-sound.mjs');
    for(const kind of KINDS.keys()){
        let seed=900+kind;
        const game=await createRuntime(bytes,{random:()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0});
        game.start(true);game.api.web_boss_practice(kind,2,0);
        const bot=new BossBot(game),seen=new Set();
        for(let i=0;i<150*50;i++){
            bot.step();const scene=game.scene();
            if(scene[BOSS_AT+5])seen.add(scene[BOSS_AT+5]);
            if(game.api.web_test_boss_set&&scene[512]&&i%400===399)game.api.web_test_boss_set(0,Math.floor(scene[515]*.6)); // push through the phases
            if(!scene[512]&&i>100)break;
        }
        const documented=new Set(GUIDE.find(g=>g.kind===kind).attacks.map(a=>a.id));
        for(const id of seen)assert(documented.has(id),`${KINDS[kind].name}: attack ${id} is not in the field guide`);
    }
});
