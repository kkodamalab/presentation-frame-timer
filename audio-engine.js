// Shared Web/Electron audio engine. No timer command ever awaits this module.
export const SOUND_TYPES=Object.freeze([
 {id:'buzzer',label:'ブザー',available:true},
 {id:'bell',label:'ベル／鈴',available:true},
 {id:'alert',label:'アラート',available:true},
 {id:'dog',label:'犬の鳴き声',available:true},
 {id:'chime',label:'チャイム',available:true},
 {id:'digital',label:'電子音',available:true}
]);
export const availableSound=id=>SOUND_TYPES.some(s=>s.id===id&&s.available);
export function soundPlan(type){
 const tone=(frequency,at,length,level,wave='sine',end=frequency)=>({frequency,at,length,level,wave,end});
 switch(type){
  case 'buzzer':return [tone(180,0,.55,.24,'square')];
  case 'bell':return [tone(880,0,1.2,.22),tone(1760,0,.8,.1),tone(2640,0,.5,.045)];
  case 'alert':return [0,.25,.5].map(at=>tone(740,at,.16,.24,'triangle'));
  case 'chime':return [523.25,659.25,783.99].map((f,i)=>tone(f,i*.18,.85,.14));
  case 'digital':return [tone(1200,0,.13,.18,'square',1800),tone(900,.15,.16,.18,'square',600)];
  default:throw Error('この効果音は未対応です。利用可能な音を選択してください。');
 }
}
export function scheduleSound(ctx,type,volume,duration=5){
 const phrase=soundPlan(type),period=Math.max(...phrase.map(t=>t.at+t.length))+.15,plan=[];
 for(let at=0;at<duration;at+=period)for(const voice of phrase)if(at+voice.at<duration)plan.push({...voice,at:at+voice.at,length:Math.min(voice.length,duration-at-voice.at)});
 const master=ctx.createGain(),limiter=ctx.createDynamicsCompressor(),nodes=[];
 // Even 100% has a conservative master gain; the limiter is an extra guard.
 master.gain.value=Math.max(0,Math.min(100,volume))/100*.5;
 limiter.threshold.value=-8;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.15;
 master.connect(limiter);limiter.connect(ctx.destination);
 const base=ctx.currentTime+.01,deadline=base+duration;
 master.gain.setValueAtTime(master.gain.value,base);master.gain.setValueAtTime(master.gain.value,deadline-.04);master.gain.linearRampToValueAtTime(0,deadline);
 let pending=plan.length,stopped=false;
 const disconnect=()=>{for(const n of nodes){try{n.disconnect();}catch{}}try{master.disconnect();limiter.disconnect();}catch{}};
 try{
  for(const t of plan){const oscillator=ctx.createOscillator(),gain=ctx.createGain(),start=base+t.at,end=start+t.length;
   oscillator.type=t.wave;oscillator.frequency.setValueAtTime(t.frequency,start);if(t.end!==t.frequency)oscillator.frequency.exponentialRampToValueAtTime(t.end,end);
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(t.level,Math.min(start+.008,end));gain.gain.exponentialRampToValueAtTime(.0001,end);
   oscillator.connect(gain);gain.connect(master);nodes.push(oscillator,gain);oscillator.onended=()=>{if(--pending===0)disconnect();};oscillator.start(start);oscillator.stop(Math.min(end+.01,deadline));
  }
 }catch(error){disconnect();throw error;}
 return ()=>{if(stopped)return;stopped=true;const now=ctx.currentTime;master.gain.cancelScheduledValues?.(now);master.gain.setValueAtTime(master.gain.value,now);master.gain.linearRampToValueAtTime(0,now+.03);for(const n of nodes){if(typeof n.stop==='function'){try{n.stop(now+.03);}catch{}}}setTimeout(disconnect,40);};
}
export class AudioEngine {
 constructor({createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),onStatus=()=>{},createMedia=url=>new Audio(url),timeoutMs=1500}={}){
  Object.assign(this,{createContext,onStatus,createMedia,timeoutMs});this.context=null;this.unlock=null;this.generation=0;this.stopActive=null;
 }
 report(level,message){try{this.onStatus({level,message});}catch{}}
 bounded(promise){let timeout;return Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('音声の有効化が時間切れです。出力デバイスを確認して試聴を押してください。タイマーは継続します。')),this.timeoutMs);})]).finally(()=>clearTimeout(timeout));}
 arm(){
  if(this.unlock)return this.unlock;
  this.unlock=this.enable().finally(()=>{this.unlock=null;});return this.unlock;
 }
 async enable(){
  try{
   if(!this.context||this.context.state==='closed'){
    this.context=this.createContext();
    this.context.onstatechange=()=>{if(['suspended','interrupted','closed'].includes(this.context.state))this.report('warning','音声出力が停止しています。出力先・ミュートを確認し、試聴で再度有効にしてください。タイマーは継続します。');};
   }
   if(this.context.state!=='running')await this.bounded(this.context.resume());
   if(this.context.state!=='running')throw Error('音声出力を有効にできませんでした。');
   this.report('info','音声が有効になりました。');return true;
  }catch(error){this.report('warning',`音声を有効にできません: ${error?.message||'不明なエラー'} タイマー操作には影響しません。`);return false;}
 }
 stop(){this.generation++;if(this.stopActive){try{this.stopActive();}catch{}this.stopActive=null;}}
 async play(type,volume,duration=5){
  this.stop();const generation=this.generation;
  if(!availableSound(type)){this.report('warning','選択した効果音は未対応です。利用可能な音を選択してください。');return false;}
  if(!Number.isFinite(volume)||volume<0||volume>100){this.report('warning','音量は0〜100%で設定してください。');return false;}
  if(!Number.isInteger(duration)||duration<1||duration>60){this.report('warning','効果音の持続時間は1〜60秒の整数で設定してください。');return false;}
  if(volume===0){this.report('info','音量0%のため無音です。');return true;}
  if(!await this.arm()||generation!==this.generation)return false;
  try{if(type==='dog'){
   const media=this.createMedia(new URL('./audio/dog-bark.wav',import.meta.url).href);
   // The bundled recording already peaks below 0.5; cap media gain at 0.5.
   media.volume=volume/100*.5;media.loop=true;let fade,finish;
   const silence=()=>{clearTimeout(finish);clearInterval(fade);media.pause();media.currentTime=0;};
   const fadeOut=(ms=40)=>{clearTimeout(finish);clearInterval(fade);const started=performance.now(),initial=media.volume;fade=setInterval(()=>{const fraction=(performance.now()-started)/ms;media.volume=Math.max(0,initial*(1-fraction));if(fraction>=1)silence();},5);};
   this.stopActive=()=>fadeOut(30);finish=setTimeout(()=>fadeOut(40),duration*1000-40);
   await this.bounded(media.play());if(generation!==this.generation){media.pause();return false;}
  }else{const stop=scheduleSound(this.context,type,volume,duration),deadline=setTimeout(stop,duration*1000);deadline.unref?.();this.stopActive=()=>{clearTimeout(deadline);stop();};}this.report('info','効果音の再生を開始しました。');return true;}
  catch(error){if(generation===this.generation)this.stop();this.report('warning',`再生できません: ${error?.message||'音声出力デバイスを確認してください。'} タイマーは継続します。`);return false;}
 }
}
export function populateSounds(select){
 select.replaceChildren(...SOUND_TYPES.map(s=>{const o=select.ownerDocument.createElement('option');o.value=s.id;o.textContent=s.label;o.disabled=!s.available;return o;}));
}
