import {framePolygon} from './frame-geometry.js';
import {colorAt} from './core.js';
// A single filled ribbon is the alpha mask; its square boundaries stay inside
// the viewport. Color fields meet along the same clockwise perimeter.
export function drawGauge(ctx,w,h,dpr,settings,progress){
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(progress<=0||!w||!h)return;
 const t=settings.thickness,inset=t/2,W=w-2*inset,H=h-2*inset,P=2*(W+H);
 ctx.fillStyle=settings.start;ctx.fillRect(0,0,w,h);
 if(settings.mode==='solid'){ctx.fillStyle=settings.solid;ctx.fillRect(0,0,w,h);}else{
 const corners=[[inset,inset],[w-inset,inset],[w-inset,h-inset],[inset,h-inset],[inset,inset]],lengths=[W,H,W,H];let distance=0;
 // Partition the frame with diagonal corner joins; no overlapping strokes.
 // Use a wider interior ring so the full stroke (including its inside half) is colored.
 for(const [x,y,i] of [[0,0,0],[w/2,0,1],[w/2,h/2,2],[0,h/2,3]]){ctx.fillStyle=colorAt([0,W/P,(W+H)/P,(2*W+H)/P][i],settings.start,settings.end);ctx.fillRect(x,y,w/2,h/2);}
 const margin=t+2;const polys=[[[0,0],[w,0],[w-margin,margin],[margin,margin]],[[w,0],[w,h],[w-margin,h-margin],[w-margin,margin]],[[w,h],[0,h],[margin,h-margin],[w-margin,h-margin]],[[0,h],[0,0],[margin,margin],[margin,h-margin]]];
 for(let i=0;i<4;i++){const [x,y]=corners[i],[nx,ny]=corners[i+1],g=ctx.createLinearGradient(x,y,nx,ny),a=distance/P,b=(distance+lengths[i])/P;g.addColorStop(0,colorAt(a,settings.start,settings.end));for(const stop of [.25,.5,.75])if(stop>a&&stop<b)g.addColorStop((stop-a)/(b-a),colorAt(stop,settings.start,settings.end));g.addColorStop(1,colorAt(b,settings.start,settings.end));ctx.fillStyle=g;ctx.beginPath();polys[i].forEach(([px,py],j)=>j?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fill();distance+=lengths[i];}
 // Until the final edge reaches the start corner, keep the start cap blue.
 if(progress<1-t/P){ctx.fillStyle=settings.start;ctx.fillRect(0,0,t+2,t+2);}
 }
 ctx.globalCompositeOperation='destination-in';ctx.beginPath();framePolygon(w,h,progress,t).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle='#fff';ctx.fill();ctx.globalCompositeOperation='source-over';
}
