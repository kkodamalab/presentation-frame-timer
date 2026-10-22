import {clamp} from './core.js';
// Filled, clockwise ribbon: outer boundary is exactly the viewport, inner
// boundary is inset by the full thickness. No offscreen stroke or rounded join.
export function framePolygon(w,h,progress,thickness){
 const t=Math.min(thickness,w/2,h/2),p=clamp(progress,0,1),P=2*(w+h-2*t);let n=p*P;
 if(p<=0)return [];
 if(n<=w)return [[0,0],[n,0],[n,t],[0,t]];
 n-=w;if(n<=h-t){const y=t+n;return [[0,0],[w,0],[w,y],[w-t,y],[w-t,t],[0,t]];}
 n-=h-t;if(n<=w-t){const x=w-t-n;return [[0,0],[w,0],[w,h],[x,h],[x,h-t],[w-t,h-t],[w-t,t],[0,t]];}
 n-=w-t;const y=Math.max(t,h-t-n);
 return [[0,0],[w,0],[w,h],[0,h],[0,y],[t,y],[t,h-t],[w-t,h-t],[w-t,t],[0,t]];
}
export const polygonPath=points=>points.length?points.map(([x,y],i)=>`${i?'L':'M'} ${x} ${y}`).join(' ')+' Z':'';
export const effectActive=(completed,elapsed,seconds)=>completed&&elapsed>=0&&elapsed<seconds*1000;
