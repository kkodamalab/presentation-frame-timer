import {AudioEngine} from '../audio-engine.js';
const engine=new AudioEngine({onStatus:status=>{window.timerAPI.audioStatus(status).catch(()=>{});}});
let lastFinish=0;
window.timerAPI.onAudioRequest(request=>{
 if(request.kind==='stop'){engine.stop();return;}
 if(request.kind==='arm'){void engine.arm();return;}
 if(request.kind==='finish'){if(request.id<=lastFinish)return;lastFinish=request.id;}
 void engine.play(request.soundType,request.soundVolume);
});
window.addEventListener('pagehide',()=>engine.stop());
