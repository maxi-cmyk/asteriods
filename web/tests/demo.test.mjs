import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRuntime} from '../runtime.mjs';

test('HD demo runs shared controller and exits on movement without saving',async()=>{
  let seed=7,writes=0;
  const g=await createRuntime(await readFile(new URL('../dist/test.wasm',import.meta.url)),{
    random:()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0,
    storage:{getItem:()=>null,setItem:()=>writes++}
  });
  for(let i=0;i<500;i++)g.step();
  assert.equal(g.state,'demo');
  const before=g.snapshot()[4];
  for(let i=0;i<500;i++)g.step();
  assert(g.snapshot()[4]>before);
  assert.equal(writes,0);
  g.step({y:0}); assert.equal(g.state,'menu');
  for(let i=0;i<20;i++)g.step({y:0});
  assert.equal(g.state,'menu');
});
