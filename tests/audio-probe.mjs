// Test-only instrumentation; the real AudioContext and media APIs still execute.
export function installAudioProbe(){
 const Native=window.AudioContext||window.webkitAudioContext;
 const stateGetter=Object.getOwnPropertyDescriptor(BaseAudioContext.prototype,'state').get;
 const stats=window.__audioProbe={contexts:0,resumes:0,starts:0,mediaPlays:0,mediaResolved:0};
 window.AudioContext=class extends Native {
  constructor(...args){super(...args);stats.contexts++;Object.defineProperty(this,'state',{get:()=>localStorage.getItem('audio-test-mode')==='normal'||!localStorage.getItem('audio-test-mode')?stateGetter.call(this):'suspended'});}
  resume(){stats.resumes++;const mode=localStorage.getItem('audio-test-mode');if(mode==='reject')return Promise.reject(new DOMException('Output device unavailable','NotAllowedError'));if(mode==='pending')return new Promise(()=>{});return super.resume();}
  createOscillator(){const o=super.createOscillator(),start=o.start.bind(o);o.start=(...args)=>{stats.starts++;return start(...args);};return o;}
 };
 const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){stats.mediaPlays++;return play.apply(this,args).then(value=>{stats.mediaResolved++;return value;});};
}
