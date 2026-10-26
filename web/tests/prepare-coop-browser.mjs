import { readFile, writeFile } from 'node:fs/promises';
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const setup = `<script>
// Synthetic controllers for browser flow checks; no physical-input claim.
const pads=[0,1].map(index=>({index,id:'Synthetic QA controller '+index,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
Object.defineProperty(navigator,'getGamepads',{value:()=>pads.filter(p=>p.connected)});
const qa=document.createElement('div');qa.style='position:fixed;bottom:0;left:0;z-index:999;background:#15212f;color:white;padding:4px;font:12px sans-serif';
qa.textContent='SYNTHETIC INPUT QA · ';
for(const i of [0,1]){
const b=document.createElement('button');b.textContent='Disconnect / reconnect pad '+i;
// Generic Event allows plain deterministic fixture objects.
b.onclick=()=>{pads[i].connected=!pads[i].connected;const e=new Event(pads[i].connected?'gamepadconnected':'gamepaddisconnected');Object.defineProperty(e,'gamepad',{value:pads[i]});window.dispatchEvent(e);};qa.append(b);
}
for(const [name,index,button] of [['P2 move + fire',0,7],['P2 pause',0,9]]) {
const b=document.createElement('button');b.textContent=name;b.onclick=()=>{pads[index].buttons[button]={pressed:true,value:1};if(button===7)pads[index].axes[0]=1;setTimeout(()=>{pads[index].buttons[button]={pressed:false,value:0};pads[index].axes[0]=0;},300);};qa.append(b);
}
document.body.append(qa);
</script><script type="module" src="./app.mjs"></script>`;
await writeFile(
    new URL('../dist/coop-browser.html', import.meta.url),
    html.replace('<script type="module" src="./app.mjs"></script>', setup),
);
console.log(
    'Prepared /coop-browser.html with synthetic controllers; excluded from production build packaging.',
);
