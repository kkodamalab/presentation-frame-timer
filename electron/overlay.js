import {effectActive} from '../frame-geometry.js';
import {drawGauge} from '../gauge.js';
import {formatTime} from '../core.js';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),remaining=document.querySelector('output');let state;
function render(){if(!state)return;const dpr=devicePixelRatio||1,w=innerWidth,h=innerHeight;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}const s=state.settings;drawGauge(ctx,w,h,dpr,s,state.elapsed/(s.duration*1000));canvas.style.opacity=s.opacity/100;remaining.style.opacity=s.opacity/100;remaining.hidden=!s.showTime;remaining.textContent=formatTime(s.duration*1000-state.elapsed);document.body.classList.toggle('blink',s.blink&&effectActive(state.completed,state.completionElapsed,s.blinkDuration));}
window.timerAPI.onState(value=>{state=value;render();});window.timerAPI.get().then(value=>{state=value;render();});window.addEventListener('resize',render);
