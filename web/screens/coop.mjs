import {element} from '../dom.mjs';
import {accuracyText} from '../records.mjs';
import {supportedPad} from '../coop-input.mjs';
import {CoopMenu} from '../coop-menu.mjs';
const colors=['#70d9ed','#efb963'];
export function createCoopScreen({input,getPads,getRuntime,getNavigation,launch,profiles}) {
    let deviceSignature='';
    let reassign=false;
    const menu=new CoopMenu(input,element,()=>getNavigation().back());
    element('coopReassign').addEventListener('click',()=>{reassign=!reassign;render();});
    const write=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
    function devices(pads) {
        const signature=JSON.stringify(pads.filter(supportedPad).map(p=>[p.index,p.id]));
        if(signature===deviceSignature)return;
        deviceSignature=signature;
        for(const prefix of ['coopDevice','reconnectDevice'])for(let slot=0;slot<2;slot++) {
            const select=element(prefix+slot);
            select.replaceChildren();
            for(const [value,label] of [['','Choose input'],['keyboard','Keyboard + mouse'],...pads.filter(supportedPad).map(p=>[String(p.index),`Controller ${p.index+1} · ${p.id}`])]) {
                const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);
            }
            select.value=input.devices[slot];
        }
    }
    for(let slot=0;slot<2;slot++) {
        for(const prefix of ['coopDevice','reconnectDevice'])element(prefix+slot).addEventListener('change',event=>{
            input.assign(slot,event.target.value,getPads());render();
        });
        element('coopProfile'+slot).value=slot;
        element('coopProfile'+slot).addEventListener('change',event=>{
            input.setProfile(slot,Number(event.target.value));render();
        });
        element('coopReady'+slot).addEventListener('click',()=>{
            const pads=getPads();
            input.join(slot,pads);
            render();
        });
    }
    let friendlyFire=element('coopFriendly').checked;
    element('coopFriendly').addEventListener('change',()=>{
        if(input.ready.some(Boolean))element('coopFriendly').checked=friendlyFire;
        else friendlyFire=element('coopFriendly').checked;
        render();
    });
    element('coopStart').addEventListener('click',()=>{
        const pads=getPads();
        if(!input.canStart(pads))return;
        input.profiles=profiles();input.begin(pads);
        const options={profiles:[...input.profileIds],friendlyFire:element('coopFriendly').checked};
        launch(()=>getNavigation().startCoop(options));
    });
    function render() {
        const pads=getPads(),runtime=getRuntime(),navigation=getNavigation();
        devices(pads);
        if(navigation?.screen==='lobby') {
            input.live=false;
            for(let i=0;i<2;i++)if(input.devices[i]!=='keyboard' && !input.pad(i,pads))input.resetSlot(i);
            for(let i=0;i<2;i++) {
                element('coopDevice'+i).value=input.devices[i];
                element('coopDevice'+i).disabled=input.ready[i];
                element('coopProfile'+i).value=input.profileIds[i];
                element('coopProfile'+i).disabled=input.ready[i];
                const button=element('coopReady'+i);
                button.disabled=!input.ready[i]&&!input.valid(pads);
                button.setAttribute('aria-pressed',String(input.ready[i]));
                const progress=menu.readyProgress[i];
                write(button,input.ready[i]?`P${i+1} ready · Cancel`:progress>0?`Hold Circle / B · ${Math.floor(progress*100)}%`:
                    input.devices[i]==='keyboard'?`Ready P${i+1}`:`Ready P${i+1} · Hold Circle / B for 1.5s`);
            }
            element('coopFriendly').disabled=input.ready.some(Boolean);
            write(element('coopLobbyStatus'),!input.valid(pads)?'Choose two different inputs and two different profiles. At least one controller is required.':input.ready.every(Boolean)?'Both pilots ready. Release controls, then Launch together.':'Hold Circle / B for 1.5s to ready your pilot. Up/down: navigate · Cross / A: select or edit · Tap Circle / B: finish editing or go back. Cancel Ready to change selections.');
            input.canStart(pads); // Arm launch after a neutral frame; navigation stays focusable.
            element('coopStart').disabled=!input.valid(pads)||!input.ready.every(Boolean);
        }
        const active=!!runtime?.coop;
        document.body.dataset.coop=String(active);
        element('coopHud').hidden=!active;
        element('coopResults').hidden=!active||!runtime?.result?.players;
        document.querySelector('.hud').hidden=active;
        document.querySelector('.combat-hud')?.classList.toggle('coop-hidden',active);
        document.querySelector('.live-stats')?.classList.toggle('coop-hidden',active);
        element('coopReassign').hidden=!active;
        if(navigation?.screen!=='pause')reassign=false;
        if(active && !input.valid(pads))reassign=true;
        element('coopReconnect').hidden=!active||!reassign;
        if(!active) { element('resume').disabled=false; return; }
        element('runLabel').textContent='Local co-op';
        element('screenTitle').textContent=navigation.screen==='pause'?'Paused':navigation.screen==='play'?'Local co-op':element('screenTitle').textContent;
        const players=runtime.coopPlayers();
        players.forEach((p,i)=>{
            const status=p.alive?'':p.lives?` · RESPAWN ${(p.respawnMs/1000).toFixed(1)}s`:' · ELIMINATED';
            const text=`P${i+1} · ${p.lives} LIVES${status}\n${p.score} · ×${p.multiplier}\nLASER ${p.charging?'CHARGING':p.laserMs?`${(p.laserMs/1000).toFixed(1)}s`:'READY'} · SHIELD ${p.shield}\nMULTI ${(p.multishotMs/1000).toFixed(1)}s · 2× ${(p.stats.doubleFireMs/1000).toFixed(1)}s`;
            write(element('coopHud'+i),text);
            element('reconnectDevice'+i).value=input.devices[i];
        });
        write(element('coopTeamScore'),`TEAM ${players[0].teamScore}`);
        write(element('coopWave'),`WAVE ${players[0].scene[19]}`);
        write(element('coopRules'),`FRIENDLY FIRE ${runtime.coop.friendlyFire?'ON':'OFF'}`);
        if(navigation.screen==='pause') {
            element('resume').disabled=!input.valid(pads);
            write(element('pauseSettingsHint'),!input.valid(pads)?'Controller lost. Reassign the missing input above; release all controls before Resume.':'Release controls before Resume · Cross / Enter: select · Circle / Esc: back');
        }
        const result=runtime.result;
        const resultBox=element('coopResults');resultBox.hidden=!result?.players;
        if(result?.players) {
            const signature=JSON.stringify(result);
            if(resultBox.dataset.signature!==signature) {
                resultBox.dataset.signature=signature;resultBox.replaceChildren();
                result.players.forEach((p,i)=>{
                    const section=document.createElement('section'),h=document.createElement('h3'),score=document.createElement('b'),body=document.createElement('p');
                    h.textContent=`P${i+1} · Profile ${p.profile+1}`;score.textContent=String(p.score);
                    section.style.setProperty('--pilot',colors[i]);
                    body.textContent=`Accuracy ${accuracyText(p.hits,p.shots)} · Chain ${p.longestChain} · ${p.destroyed} rocks · Best ×${p.bestMultiplier} · Laser ${p.laserKills} kills`;
                    section.append(h,score,body);resultBox.append(section);
                });
            }
        }
    }
    return {render,resetMenu(){menu.reset();},handlePads(pads,now){menu.sample(pads,now);},reset(){menu.reset();input.live=false;input.reset();render();}};
}
