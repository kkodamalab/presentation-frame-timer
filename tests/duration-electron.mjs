// Real elapsed-time checks in the independent, hidden, sandboxed renderer.
import {_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const app=await electron.launch({args:['.'],timeout:60000});
try{
 let audio,control,overlay;for(let i=0;i<100;i++){audio=app.windows().find(p=>p.url().endsWith('/audio.html'));control=app.windows().find(p=>p.url().endsWith('/control.html'));overlay=app.windows().find(p=>p.url().endsWith('/overlay.html'));if(audio&&control&&overlay)break;await new Promise(r=>setTimeout(r,100));}
 await control.waitForFunction(()=>document.querySelector('#display').options.length>0);await control.evaluate(()=>window.timerAPI.settings({duration:1,sound:false,blink:true,blinkDuration:60}));await control.evaluate(()=>window.timerAPI.command('reset'));await control.evaluate(()=>window.timerAPI.command('start'));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/control.html')).close());
 const rows=await audio.evaluate(async()=>{const {AudioEngine}=await import('../audio-engine.js');return Promise.all([1,5,30,60].map(async duration=>{let media,started,ended,resolve;const paused=new Promise(r=>resolve=r);const engine=new AudioEngine({createMedia:url=>{media=new Audio(url);const pause=media.pause.bind(media);media.pause=()=>{ended=performance.now();pause();resolve();};return media;}});started=performance.now();if(!await engine.play('dog',50,duration))throw Error('dog playback failed');const loop=media.loop;await Promise.race([paused,new Promise((_,reject)=>setTimeout(()=>reject(Error('duration deadline missed')),65000))]);return {duration,elapsed:(ended-started)/1000,loop,paused:media.paused,volume:media.volume};}));});
 for(const r of rows){assert.equal(r.loop,true);assert.equal(r.paused,true);assert.equal(r.volume,0);assert.ok(Math.abs(r.elapsed-r.duration)<.35,JSON.stringify(r));}
 // After ~60s playback, the independently timed 60s blink is still active
 // until its own deadline (timer finished one second after playback started).
 await overlay.waitForFunction(()=>document.querySelector('output').textContent==='00:00');await overlay.waitForFunction(()=>!document.body.classList.contains('blink'),null,{timeout:4000});const state=await control.evaluate(()=>window.timerAPI.get());assert.equal(state.completed,true);assert.ok(state.completionElapsed>=60000);await control.evaluate(()=>window.timerAPI.command('reset'));assert.equal(await overlay.evaluate(()=>document.body.classList.contains('blink')),false);
 await mkdir('test-results',{recursive:true});await writeFile('test-results/desktop-real-duration-report.json',JSON.stringify({platform:process.platform,hiddenPanel:true,rows,blinkDuration:60,blinkCompletionElapsed:state.completionElapsed,actualSpeakerVerified:false},null,2));console.log('Real hidden-renderer audio/blink deadlines passed',rows);
}finally{await app.close();}
