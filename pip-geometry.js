import {clamp,perimeterPoints,colorAt} from './core.js';
// The Web and Electron Canvas renderer uses the same perimeterPoints/colorAt.
// Only this SVG adapter is new; its mask has exactly one continuous stroke.
export function pipGeometry(width,height,progress,thickness,start,end){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=2||height<=2)return null;
 const t=Math.min(thickness,Math.min(width,height)-2),inset=t/2+1;
 const W=width-2*inset,H=height-2*inset,P=2*(W+H);
 if(P<=0)return null;
 const p=clamp(progress,0,1),points=perimeterPoints(width,height,p,inset);
 const d=points.map(([x,y],i)=>`${i?'L':'M'} ${x} ${y}`).join(' ')+(p===1?' Z':'');
 const corners=[[inset,inset],[width-inset,inset],[width-inset,height-inset],[inset,height-inset],[inset,inset]],lengths=[W,H,W,H],margin=t+2;
 const polys=[[[0,0],[width,0],[width-margin,margin],[margin,margin]],[[width,0],[width,height],[width-margin,height-margin],[width-margin,margin]],[[width,height],[0,height],[margin,height-margin],[width-margin,height-margin]],[[0,height],[0,0],[margin,margin],[margin,height-margin]]];
 let distance=0;
 const fields=lengths.map((length,i)=>{const a=distance/P,b=(distance+length)/P;distance+=length;return {from:corners[i],to:corners[i+1],polygon:polys[i],stops:[{offset:0,color:colorAt(a,start,end)},...[.25,.5,.75].filter(stop=>stop>a&&stop<b).map(stop=>({offset:(stop-a)/(b-a),color:colorAt(stop,start,end)})),{offset:1,color:colorAt(b,start,end)}]};});
 return {width,height,progress:p,thickness:t,inset,perimeter:P,points,d,fields,startCap:p<1-t/P};
}
