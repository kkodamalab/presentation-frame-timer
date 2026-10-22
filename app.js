import {AudioEngine,populateSounds,availableSound} from './audio-engine.js';
import {WebOverlay} from './web-overlay.js';
import {drawGauge} from './gauge.js';
import {Timer,formatTime,clamp} from './core.js';
const $=id=>document.getElementById(id);
const defaults={duration:600,mode:'gradient',start:'#4385ff',end:'#f45b65',solid:'#4385ff',thickness:6,showTime:true,position:'top-right',fontSize:24,opacity:90,blink:false,sound:false,soundType:'buzzer',soundVolume:50,showDemo:true};
let settings={...defaults};
try{const saved=JSON.parse(localStorage.getItem('frame-timer-v1'));if(saved&&typeof saved==='object')for(const key of Object.keys(defaults))if(typeof saved[key]===typeof defaults[key])settings[key]=saved[key];}catch{}
for(const [key,min,max] of [['duration',1,7200],['thickness',3,20],['fontSize',12,48],['opacity',20,100],['soundVolume',0,100]])settings[key]=Number.isFinite(settings[key])?clamp(settings[key],min,max):defaults[key];
for(const key of ['start','end','solid'])if(!/^#[0-9a-f]{6}$/i.test(settings[key]))settings[key]=defaults[key];
if(!['gradient','solid'].includes(settings.mode))settings.mode='gradient';
if(!['top-right','top-left','bottom-right','bottom-left'].includes(settings.position))settings.position='top-right';
if(!availableSound(settings.soundType))settings.soundType='buzzer';
const params=new URLSearchParams(location.search),obs=params.get('mode')==='obs';
if(obs){document.body.classList.add('obs');const sec=Number(params.get('duration'));if(Number.isFinite(sec)&&sec>=1&&sec<=7200)settings.duration=sec;}
const timer=new Timer(settings.duration*1000);let notified=false;
populateSounds($('sound-type'));
const audio=new AudioEngine({onStatus:({level,message})=>{$('audio-warning').textContent=level==='warning'?message:'';$('audio-status').textContent=level==='info'?message:'';}});
const bindings={'color-mode':'mode','start-color':'start','end-color':'end','solid-color':'solid',thickness:'thickness','show-time':'showTime',position:'position','font-size':'fontSize',opacity:'opacity',blink:'blink',sound:'sound','show-demo':'showDemo','sound-type':'soundType','sound-volume':'soundVolume'};
function save(){try{localStorage.setItem('frame-timer-v1',JSON.stringify(settings));}catch{}}
function sync(){for(const [id,key]of Object.entries(bindings)){const e=$(id);if(e.type==='checkbox')e.checked=settings[key];else e.value=settings[key];} $('minutes').value=Math.floor(settings.duration/60);$('seconds').value=settings.duration%60;$('gradient-options').hidden=settings.mode!=='gradient';$('solid-options').hidden=settings.mode!=='solid';$('scrub-wrap').hidden=!settings.showDemo;$('thickness-value').value=settings.thickness+' px';$('font-size-value').value=settings.fontSize+' px';$('opacity-value').value=settings.opacity+'%';$('sound-volume-value').textContent=settings.soundVolume+'%';document.querySelector('.gradient-sample').style.background=`linear-gradient(90deg,${settings.start},#22b8df,#35cc8b,#f4d448,${settings.end})`;document.querySelectorAll('[data-min]').forEach(e=>e.classList.toggle('selected',Number(e.dataset.min)*60===settings.duration));const url=new URL(location.href);url.search=`mode=obs&duration=${settings.duration}`;$('obs-link').href=url.href;}
for(const [id,key]of Object.entries(bindings))$(id).addEventListener('input',()=>{const e=$(id);settings[key]=e.type==='checkbox'?e.checked:e.type==='range'?Number(e.value):e.value;save();sync();render();if(key==='sound'&&e.checked)void audio.arm();});
$('sound-preview').onclick=()=>{void audio.play(settings.soundType,settings.soundVolume);};
function setDuration(seconds){settings.duration=seconds;timer.duration=seconds*1000;timer.reset();notified=false;save();sync();render();}
document.querySelectorAll('[data-min]').forEach(e=>e.onclick=()=>setDuration(Number(e.dataset.min)*60));
$('apply-time').onclick=()=>{const m=Number($('minutes').value),s=Number($('seconds').value),total=m*60+s;if(!Number.isInteger(m)||!Number.isInteger(s)||m<0||s<0||s>59||total<1||total>7200){$('time-error').textContent='1秒〜120分で設定してください（秒は0〜59）。';return;}$('time-error').textContent='';setDuration(total);};
document.querySelectorAll('[data-color]').forEach(e=>e.onclick=()=>{settings.solid=e.dataset.color;save();sync();render();});
$('start').onclick=()=>{if(timer.started!==null)timer.pause();else{if(timer.value()>=timer.duration){timer.reset();notified=false;}timer.start();}render();if(settings.sound)void audio.arm();};
$('reset').onclick=()=>{timer.reset();notified=false;render();};
$('scrub').oninput=()=>{timer.seek(Number($('scrub').value)/100);notified=timer.value()>=timer.duration;render();};
$('fullscreen').onclick=async()=>{try{await $('stage').requestFullscreen();}catch{$('state').textContent='この環境では全画面に対応していません';}};
$('exit-fullscreen').onclick=()=>document.exitFullscreen();
$('demo').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();};
$('overlay').onclick=()=>$('overlay-dialog').showModal();$('close-dialog').onclick=()=>$('overlay-dialog').close();
const canvas=$('gauge'),ctx=canvas.getContext('2d');let w=0,h=0,dpr=1;
function resize(){const rect=$('stage').getBoundingClientRect();w=rect.width;h=rect.height;dpr=window.devicePixelRatio||1;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);render();}
const webOverlay=new WebOverlay({button:$('web-overlay'),status:$('web-overlay-status'),mode:$('web-overlay-mode'),background:$('web-overlay-background'),color:$('web-overlay-color'),onTick:render});
function draw(progress){drawGauge(ctx,w,h,dpr,settings,progress);}

function render(){const elapsed=timer.value(),p=elapsed/timer.duration,done=p>=1;if(done&&timer.started!==null){timer.pause();if(!notified){notified=true;if(settings.sound)void audio.play(settings.soundType,settings.soundVolume);}}const time=formatTime(timer.duration-elapsed);$('remaining').textContent=time;$('main-time').textContent=time;$('percent').textContent=(p*100).toFixed(p>0&&p<1?1:0)+'%';$('progress').value=p*100;$('scrub').value=p*100;$('state').textContent=done?'終了':timer.started!==null?'進行中':elapsed>0?'一時停止':'待機中';$('start').textContent=timer.started!==null?'Ⅱ PAUSE':elapsed>0&&!done?'▶ RESUME':'▶ START';const e=$('remaining');e.hidden=!settings.showTime;e.style.fontSize=settings.fontSize+'px';e.style.opacity=settings.opacity/100;e.style.top=settings.position.startsWith('top')?'20px':'auto';e.style.bottom=settings.position.startsWith('bottom')?'20px':'auto';e.style.left=settings.position.endsWith('left')?'20px':'auto';e.style.right=settings.position.endsWith('right')?'20px':'auto';e.classList.toggle('blink',done&&settings.blink);draw(p);webOverlay.update({settings,elapsed,duration:timer.duration,done,running:timer.started!==null});}
sync();new ResizeObserver(resize).observe($('stage'));window.addEventListener('resize',resize);document.addEventListener('visibilitychange',render);document.addEventListener('fullscreenchange',resize);if(obs)timer.start();function loop(){if(timer.started!==null&&!webOverlay.isOpen)render();requestAnimationFrame(loop);}requestAnimationFrame(loop);render();
