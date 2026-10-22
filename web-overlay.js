import {formatTime} from './core.js';
import {pipGeometry} from './pip-geometry.js';
const ns='http://www.w3.org/2000/svg';
function svgNode(doc,tag,attrs={}){const el=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));return el;}
export class WebOverlay {
 constructor({button,status,mode,background,color,onTick}){
  Object.assign(this,{button,status,mode,background,color,onTick});this.window=null;this.opening=false;this.snapshot=null;
  this.supported=window.isSecureContext&&typeof window.documentPictureInPicture?.requestWindow==='function';
  button.addEventListener('click',()=>this.open());
  for(const input of [mode,background,color])input.addEventListener('input',()=>{this.describe();this.paint();});
  this.describe();
 }
 get isOpen(){return Boolean(this.window&&!this.window.closed);}
 describe(message=''){
  const base=this.supported?'独立したPiPウィンドウを開きます。操作はこのタブで行います。':'このブラウザはDocument Picture-in-Picture非対応です。通常Web版のタイマーをそのままご利用ください。';
  this.status.textContent=message||base;
  if(this.background.value==='transparent')this.status.textContent+=' CSSの透明背景を試しますが、OS上の透過は保証できず自動判定もできません。不透明なら「暗色」または「単色」を選んでください。';
 }
 async open(){
  if(this.opening)return;
  if(!this.supported){this.describe();return;}
  if(this.isOpen){this.window.focus();this.describe('PiPは既に開いています。操作は元タブで行います。');return;}
  this.opening=true;this.button.disabled=true;
  let win;
  try{
   // Call immediately in the original click handler, before any other await.
   win=await window.documentPictureInPicture.requestWindow(this.mode.value==='compact'?{width:360,height:200}:{width:960,height:540});
   if(win.closed)throw Error('PiP window closed before initialization');
   this.window=win;const doc=win.document;doc.title='Frame Timer — WEB OVERLAY（実験版）';doc.documentElement.lang='ja';
   const style=doc.createElement('link');style.rel='stylesheet';style.href=new URL('./web-overlay.css',import.meta.url).href;doc.head.append(style);
   this.svg=svgNode(doc,'svg',{id:'pip-gauge',role:'img','aria-label':'左上から時計回りに進む一本の連続ゲージ'});
   this.remaining=doc.createElement('output');this.remaining.id='pip-remaining';
   doc.body.replaceChildren(this.svg,this.remaining);
   win.addEventListener('pagehide',()=>this.cleanup(win),{once:true});
   win.addEventListener('resize',()=>this.paint());
   this.observer=new win.ResizeObserver(()=>this.paint());this.observer.observe(doc.documentElement);
   this.button.textContent='WEB OVERLAY（表示中）';this.describe('PiPを開きました。サイズ・位置はブラウザの制限内で手動変更してください。閉じても元タブのタイマーは続きます。');
   this.onTick();this.paint();
   const animate=()=>{if(!this.isOpen||this.window!==win)return;if(this.snapshot?.running||this.snapshot?.blinking)this.onTick();this.frame=win.requestAnimationFrame(animate);};
   this.frame=win.requestAnimationFrame(animate);
  }catch(error){
   if(win&&!win.closed)win.close();if(this.window===win)this.cleanup(win,false);
   this.describe(`PiPを開けませんでした（${error.name||'Error'}）。起動には対応するChrome/Edgeの通常タブで直接クリックしてください。通常Web版は引き続き操作できます。`);
  }finally{this.opening=false;this.button.disabled=false;}
 }
 cleanup(win,notify=true){
  if(this.window!==win)return;
  this.observer?.disconnect();try{win.cancelAnimationFrame(this.frame);}catch{}
  this.window=null;this.svg=null;this.remaining=null;this.button.textContent='WEB OVERLAY（実験版）';
  if(notify)this.describe('PiPを閉じました。元タブのタイマーは維持されています。再び開くと現在の経過時間を表示します。');
  this.onTick();
 }
 update(snapshot){this.snapshot=snapshot;if(this.isOpen)this.paint();}
 paint(){
  if(!this.isOpen||!this.snapshot||!this.svg)return;
  const win=this.window,doc=win.document,{settings:s,elapsed,duration,done}=this.snapshot;
  const g=pipGeometry(win.innerWidth,win.innerHeight,elapsed/duration,s.thickness,s.start,s.end);if(!g)return;
  doc.body.dataset.mode=this.mode.value;doc.body.classList.toggle('blink',this.snapshot.blinking);
  const bg=this.background.value==='transparent'?'transparent':this.background.value==='solid'?this.color.value:'#10141c';
  doc.documentElement.style.background=bg;doc.body.style.background=bg;
  this.svg.setAttribute('viewBox',`0 0 ${g.width} ${g.height}`);this.svg.setAttribute('width',g.width);this.svg.setAttribute('height',g.height);
  this.svg.dataset.progress=String(g.progress);this.svg.dataset.perimeter=String(g.perimeter);this.svg.style.opacity=s.opacity/100;
  const defs=svgNode(doc,'defs'),mask=svgNode(doc,'mask',{id:'pip-mask',maskUnits:'userSpaceOnUse',x:0,y:0,width:g.width,height:g.height});
  mask.append(svgNode(doc,'path',{d:g.d,fill:'white'}));defs.append(mask);
  const field=svgNode(doc,'g',{mask:'url(#pip-mask)'});if(g.progress===0)field.setAttribute('visibility','hidden');
  if(s.mode==='solid')field.append(svgNode(doc,'rect',{width:g.width,height:g.height,fill:s.solid}));
  else{
   for(const [x,y,i] of [[0,0,0],[g.width/2,0,1],[g.width/2,g.height/2,2],[0,g.height/2,3]])field.append(svgNode(doc,'rect',{x,y,width:g.width/2,height:g.height/2,fill:g.fields[i].stops[0].color}));
   g.fields.forEach((f,i)=>{const gradient=svgNode(doc,'linearGradient',{id:`pip-color-${i}`,gradientUnits:'userSpaceOnUse',x1:f.from[0],y1:f.from[1],x2:f.to[0],y2:f.to[1]});for(const stop of f.stops)gradient.append(svgNode(doc,'stop',{offset:stop.offset,'stop-color':stop.color}));defs.append(gradient);field.append(svgNode(doc,'polygon',{points:f.polygon.map(p=>p.join(',')).join(' '),fill:`url(#pip-color-${i})`}));});
   if(g.startCap)field.append(svgNode(doc,'rect',{width:g.thickness+2,height:g.thickness+2,fill:s.start}));
  }
  this.svg.replaceChildren(defs,field);
  this.remaining.textContent=formatTime(duration-elapsed);this.remaining.hidden=!s.showTime;this.remaining.style.opacity=s.opacity/100;
  this.remaining.style.fontSize=(this.mode.value==='compact'?Math.max(28,s.fontSize*2):s.fontSize)+'px';
  this.remaining.dataset.position=s.position;
 }
}
