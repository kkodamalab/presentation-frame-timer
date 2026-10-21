export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
// One subpath, one start, clockwise; no dash arrays or repeated strokes.
export function perimeterPoints(width,height,progress,inset=0){
 const w=Math.max(0,width-2*inset),h=Math.max(0,height-2*inset);
 let left=2*(w+h)*clamp(progress,0,1);
 const points=[[inset,inset]];
 if(left===0)return points;
 const corners=[[inset+w,inset],[inset+w,inset+h],[inset,inset+h],[inset,inset]];
 let x=inset,y=inset;
 for(const [nx,ny] of corners){const length=Math.hypot(nx-x,ny-y);if(!length)continue;const t=Math.min(1,left/length);points.push([x+(nx-x)*t,y+(ny-y)*t]);left-=length;x=nx;y=ny;if(left<=0)break;}
 return points;
}
export class Timer{
 constructor(duration=600000,now=()=>Date.now()){this.duration=duration;this.now=now;this.elapsed=0;this.started=null;}
 value(){return Math.min(this.duration,this.elapsed+(this.started===null?0:Math.max(0,this.now()-this.started)));}
 start(){if(this.started===null&&this.value()<this.duration)this.started=this.now();}
 pause(){this.elapsed=this.value();this.started=null;}
 reset(){this.elapsed=0;this.started=null;}
 seek(progress){this.pause();this.elapsed=this.duration*clamp(progress,0,1);}
}
export function formatTime(ms){const seconds=Math.ceil(Math.max(0,ms)/1000);return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
export function colorAt(t,start,end){
 const stops=[start,'#22b8df','#35cc8b','#f4d448',end];
 const p=clamp(t,0,1)*4,i=Math.min(3,Math.floor(p)),f=p-i;
 const rgb=c=>[1,3,5].map(n=>parseInt(c.slice(n,n+2),16));
 const a=rgb(stops[i]),b=rgb(stops[i+1]);return `rgb(${a.map((v,j)=>Math.round(v+(b[j]-v)*f)).join(',')})`;
}
