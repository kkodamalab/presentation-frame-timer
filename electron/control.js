import {populatePositions,updateTimePreview} from '../time-display.js';
import {populateSounds} from '../audio-engine.js';
import {formatTime} from '../core.js';
const $=id=>document.getElementById(id);let state,displaySignature='';
async function run(promise){try{await promise;$('error').textContent='';}catch(e){$('error').textContent=e.message;}}
populateSounds($('sound-type'));populatePositions($('position'));
function preview(){if(!state)return;const display=state.displays.find(d=>d.id===state.displayId)||state.displays[0];const s=state.settings;for(const [key,unit] of [['fontSize','px'],['timeOpacity','%'],['timeMargin','px']])$(key+'-value').textContent=s[key]+unit;updateTimePreview($('time-preview'),$('preview-time'),s,formatTime(s.duration*1000-state.elapsed),display?.bounds.width||1920,display?.bounds.height||1080);}
function sync(value){state=value;const s=value.settings;$('remaining').textContent=formatTime(s.duration*1000-value.elapsed);$('status').textContent=value.completed?'終了':value.running?'進行中':value.elapsed?'一時停止':'待機中';
 const signature=JSON.stringify([value.displays,value.displayId]);if(signature!==displaySignature){displaySignature=signature;$('display').replaceChildren(...value.displays.map(d=>{const o=document.createElement('option');o.value=d.id;o.textContent=`${d.label}${d.primary?' (主画面)':''} — ${d.bounds.width}×${d.bounds.height} DIP / ${d.scaleFactor*100}% / (${d.bounds.x}, ${d.bounds.y})`;return o;}));$('display').value=value.displayId;}
 for(const key of Object.keys(s)){const e=$(key);if(!e||document.activeElement===e)continue;if(e.type==='checkbox')e.checked=s[key];else e.value=s[key];}
 for(const b of document.querySelectorAll('[data-action]'))b.disabled=b.dataset.action==='pause'?!value.running:['start','resume'].includes(b.dataset.action)?value.running||value.completed:false;
 $('sound-type').value=s.soundType;if(document.activeElement!==$('sound-volume'))$('sound-volume').value=s.soundVolume;$('sound-volume-value').textContent=s.soundVolume+'%';
 preview();
 const audio=value.audioStatus;if(audio){$('audio-warning').textContent=audio.level==='warning'?audio.message:'';$('audio-status').textContent=audio.level==='info'?audio.message:'';}
}
let layoutReady=false;function reportSize(){if(layoutReady)window.timerAPI.contentSize({height:Math.ceil($('control-content').getBoundingClientRect().height+32)}).catch(e=>{$('error').textContent=e.message;});}
window.timerAPI.onState(sync);window.timerAPI.get().then(value=>{sync(value);document.fonts.ready.then(()=>requestAnimationFrame(()=>{layoutReady=true;reportSize();}));});
new ResizeObserver(reportSize).observe($('control-content'));
new ResizeObserver(preview).observe($('time-preview'));
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{run(window.timerAPI.command(b.dataset.action));if(state?.settings.sound&&['start','resume'].includes(b.dataset.action))run(window.timerAPI.armAudio());}));
$('duration-form').addEventListener('submit',e=>{e.preventDefault();run(window.timerAPI.settings({duration:Number($('duration').value)}));});
for(const key of ['mode','start','end','solid','thickness','opacity','showTime','visible','blink','sound','soundDuration','blinkDuration','fontSize','timeColor','position','timeOpacity','timeMargin'])$(key).addEventListener('input',()=>{const e=$(key);run(window.timerAPI.settings({[key]:e.type==='checkbox'?e.checked:['range','number'].includes(e.type)?Number(e.value):e.value}));if(key==='sound'&&e.checked)run(window.timerAPI.armAudio());});
$('display').addEventListener('change',()=>run(window.timerAPI.display(Number($('display').value))));

$('sound-type').addEventListener('input',()=>run(window.timerAPI.settings({soundType:$('sound-type').value})));
$('sound-volume').addEventListener('input',()=>{$('sound-volume-value').textContent=$('sound-volume').value+'%';run(window.timerAPI.settings({soundVolume:Number($('sound-volume').value)}));});
$('sound-preview').addEventListener('click',()=>run(window.timerAPI.previewAudio()));
