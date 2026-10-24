import { PixelRenderer, loadArt } from './renderer.mjs';
try {
  new PixelRenderer(document.querySelector('#comparison'), await loadArt()).comparison();
} catch (error) {
  document.querySelector('.description').textContent = 'Could not load pixel assets. Reload the page after rebuilding.';
  console.error(error);
}


// The same renderer used in play, with explicit synthetic stress fixtures.
import {REGIONS} from './regions.mjs';
const review=document.querySelector('#presentationReview');
const reviewArt=await loadArt();
function reviewScene(wave,time){
    const scene=new Float32Array(576);
    scene[0]=2;scene[2]=time;scene[37]=time;scene[19]=wave;
    scene[4]=110;scene[5]=150;scene[6]=1;scene[7]=3;scene[45]=1;
    scene[22]=1;scene[21]=110;scene[20]=4;scene[63]=1;
    scene[15]=1;scene[55]=1;scene[14]=3000;
    for(let i=0;i<24;i++){
        const offset=64+i*8;
        scene.set([1,185+(i*53)%280,45+(i*31)%200,6,0,i%3,-2,0],offset);
    }
    for(let i=0;i<12;i++)scene.set([1,140+i*17,135+(i%3-1)*9,7,0,0],256+i*6);
    return scene;
}
function fixture(label,wave,configure){
    const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');
    canvas.width=480;canvas.height=270;caption.textContent=label;
    figure.append(canvas,caption);review.append(figure);
    const renderer=new PixelRenderer(canvas,reviewArt);
    const scene=reviewScene(wave,1000);
    configure(renderer,scene);renderer.render(scene);
}
for(let i=1;i<REGIONS.length;i++){
    const region=REGIONS[i];
    fixture(`${region.enter.gesture} · busy midpoint · ${region.enter.ms} ms`,region.first,(renderer,scene)=>{
        renderer.backgrounds.timeline.observe({wave:region.first-1,time:1000,run:true});
        renderer.backgrounds.timeline.observe({wave:region.first,time:1000,run:true});
        scene[37]=1000+region.enter.ms*.5;
    });
}
for(const [phase,fan,label] of [[1,0,'Lance warning: 900 ms'],[2,0,'Lance discharge: clear upper/lower escape routes'],[1,1,'Fan warning: locked aim, narrow spread']]){
    fixture(`Sentinel · ${label}`,5,(renderer,scene)=>{
        scene.fill(0,64,256);scene[22]=0;
        scene.set([1,414,135,12,18,phase,300,150,fan,1,5,0,110],512);
    });
}
