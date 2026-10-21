import { Controls, radial, movementResponse, readController } from './controls.mjs';

export function stickValues(pad, settings, state=new Map()) {
  const controller=readController(pad,settings,state);
  return [0,2].map(offset => {
    const raw=[0,1].map(axis=>Math.max(-1,Math.min(1,Number(pad?.axes[offset+axis]) || 0)));
    let adjusted=radial(...raw,offset===0?settings.deadzone:settings.aimDeadzone);
    if(offset===0)adjusted=movementResponse(...adjusted,settings.movementSensitivity);
    else adjusted=[controller?.aimX || 0,controller?.aimY || 0];
    return {raw,adjusted};
  });
}

export class DriftSample {
  constructor(index, now) { this.index=index;this.started=now;this.peak=0;this.peaks=[0,0];this.count=0; }
  update(pad,now) {
    if(!pad?.connected || pad.index!==this.index || pad.mapping!=='standard')return {error:'Controller disconnected. Reconnect and sample again.'};
    for(const offset of [0,2]) {
      const length=Math.hypot(pad.axes[offset] || 0,pad.axes[offset+1] || 0);
      if(!Number.isFinite(length) || length>.4)return {error:'Stick moved too far. Release both sticks and sample again.'};
      this.peak=Math.max(this.peak,length);
      this.peaks[offset/2]=Math.max(this.peaks[offset/2],length);
    }
    this.count++;
    if(now-this.started<2000 || this.count<20)return {pending:true};
    const suggested=Math.ceil((this.peak+.03)*100)/100;
    if(suggested>.45)return {error:'Drift is too high for a reliable suggestion. Adjust manually or try another controller.'};
    return {suggested:Math.max(.05,suggested),deadzones:this.peaks.map(peak=>Math.max(.05,Math.ceil((peak+.03)*100)/100))};
  }
}

export function setupCalibration({settings,findController,persist,render}) {
  const panel=document.querySelector('#calibration');
  const preview=document.querySelector('#inputPreview');
  const status=document.querySelector('#calibrationStatus');
  const sampleButton=document.querySelector('#sampleDrift');
  const applyButton=document.querySelector('#applyDeadzone');
  const previewControls=new Controls(settings);
  const plotState=new Map();
  let sampling=null,suggestion=null,previous=null,elapsed=0,x=160,y=65,angle=0,pointer=null;
  function reset() {
    sampling=null;suggestion=null;previous=null;elapsed=0;x=160;y=65;angle=0;pointer=null;
    previewControls.clear();plotState.clear();applyButton.disabled=true;
    status.textContent='Leave both sticks untouched for a two-second drift sample.';
  }
  sampleButton.addEventListener('click',()=>{
    const pad=findController();
    if(!pad) {status.textContent='Connect a standard controller and press a button, then try again.';return;}
    sampling=new DriftSample(pad.index,performance.now());suggestion=null;
    applyButton.disabled=true;status.textContent='Sampling for two seconds. Keep both sticks untouched…';
  });
  applyButton.addEventListener('click',()=>{
    if(suggestion===null)return;
    settings.deadzone=suggestion[0];settings.aimDeadzone=suggestion[1];render();persist();
    status.textContent=`Selected left ${Math.round(suggestion[0]*100)}%, right ${Math.round(suggestion[1]*100)}%. Press Apply to keep them.`;
    suggestion=null;applyButton.disabled=true;
  });
  preview.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse')return;
    previewControls.activateMouseAim();
    const rect=preview.getBoundingClientRect();
    pointer=[(event.clientX-rect.left)*320/rect.width,(event.clientY-rect.top)*130/rect.height];
  });
  preview.addEventListener('pointerdown',()=>preview.focus());
  preview.addEventListener('keydown',event=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',...Object.values(settings.keys)].includes(event.code)) {
      event.preventDefault();previewControls.keyDown(event.code,event.repeat);
    }
  });
  preview.addEventListener('keyup',event=>previewControls.keyUp(event.code));
  preview.addEventListener('blur',()=>{previewControls.clear();pointer=null;});
  preview.addEventListener('pointerleave',()=>{pointer=null;});
  function setText(element,text) {
    if(element.textContent!==text)element.textContent=text;
  }
  function update(now) {
    const delta=previous===null?0:Math.min(60,now-previous);previous=now;
    const pad=findController();
    const connected=!!pad;
    sampleButton.disabled=!connected || !!sampling;
    setText(panel.querySelector('#calibrationController'),connected?pad.id:'No standard controller detected. Connect one and press a button.');
    const sticks=stickValues(pad,settings,plotState);
    for(const [i,stick] of sticks.entries()) {
      const plot=panel.querySelector(i===0?'#moveStick':'#aimStick');
      for(const name of ['raw','adjusted']) {
        const dot=plot.querySelector(`.${name}`);
        dot.setAttribute('cx',50+stick[name][0]*44);dot.setAttribute('cy',50+stick[name][1]*44);
      }
      plot.querySelector('.deadzone').setAttribute('r',(i===0?settings.deadzone:settings.aimDeadzone)*44);
      const values=panel.querySelector(i===0?'#moveValues':'#aimValues');
      setText(values,`Raw ${stick.raw.map(v=>v.toFixed(2)).join(', ')} / adjusted ${stick.adjusted.map(v=>v.toFixed(2)).join(', ')}`);
    }
    if(sampling) {
      const result=sampling.update(pad,now);
      if(!result.pending) {
        sampling=null;
        if(result.error)status.textContent=result.error;
        else {
          suggestion=result.deadzones;applyButton.disabled=false;
          status.textContent=`Suggested deadzones: left ${Math.round(suggestion[0]*100)}%, right ${Math.round(suggestion[1]*100)}%. Use these or keep your current settings.`;
        }
      }
    }
    // Match the game's fixed 20 ms input ticks, without advancing gameplay.
    elapsed+=delta;
    while(elapsed>=20) {
      if(pointer)previewControls.aimAt(pointer[0]-x,pointer[1]-y);
      const input=previewControls.sample(pad,now);
      const dx=(input.x-2048)/(input.x>=2048?2047:2048),dy=(input.y-2048)/(input.y>=2048?2047:2048);
      const scale=2/Math.max(1,Math.hypot(dx,dy))*(input.precision ? .5 : 1);
      x=Math.max(14,Math.min(306,x+dx*scale));y=Math.max(14,Math.min(116,y+dy*scale));
      if(input.aimX || input.aimY)angle=Math.atan2(input.aimY,input.aimX)*180/Math.PI;
      elapsed-=20;
    }
    preview.querySelector('#previewShip').setAttribute('transform',`translate(${x} ${y}) rotate(${angle})`);
  }
  return {update,reset};
}
