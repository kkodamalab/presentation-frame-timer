// Launch the actual portable EXE, not the unpacked app or NSIS installer.
import {chromium} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {installAudioProbe} from './audio-probe.mjs';
if(process.platform!=='win32')throw Error('Windows required');
const exe=path.resolve('release/Presentation-Frame-Timer-Portable.exe');
const child=spawn(exe,['--remote-debugging-port=9223'],{stdio:'ignore'});let browser,spawnError;
child.on('error',e=>{spawnError=e;});
try{
 let ready=false;for(let i=0;i<120;i++){if(spawnError)throw spawnError;try{const response=await fetch('http://127.0.0.1:9223/json/version');if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,'portable EXE started its Chromium debugging endpoint');
 browser=await chromium.connectOverCDP('http://127.0.0.1:9223');const context=browser.contexts()[0];let control,overlay,audio;
 for(let i=0;i<80;i++){control=context.pages().find(p=>p.url().endsWith('/control.html'));overlay=context.pages().find(p=>p.url().endsWith('/overlay.html'));audio=context.pages().find(p=>p.url().endsWith('/audio.html'));if(control&&overlay&&audio)break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(control&&overlay&&audio,'portable control, overlay and audio windows');await control.waitForFunction(()=>document.querySelector('#display').options.length>0);
 assert.match(await control.locator('h1').textContent(),/v1\.3\.0/);
 assert.match(control.url(),/app\.asar/,'portable executes packaged application');
 for(const [id,value] of [['soundDuration','30'],['blinkDuration','60']]){await control.locator('#'+id).scrollIntoViewIfNeeded();assert.equal(await control.locator('#'+id).isVisible(),true);await control.locator('#'+id).fill(value);assert.equal((await control.evaluate(()=>window.timerAPI.get())).settings[id],Number(value));await control.screenshot({path:`test-results/desktop-portable-v130-${id}.png`});}
 await audio.addInitScript(installAudioProbe);await audio.reload();await audio.waitForFunction(()=>Boolean(window.__audioProbe));
 for(const mode of ['reject','pending']){await audio.evaluate(m=>localStorage.setItem('audio-test-mode',m),mode);await audio.reload();await audio.waitForFunction(()=>Boolean(window.__audioProbe));await control.evaluate(()=>window.timerAPI.settings({duration:30,sound:true}));await control.locator('[data-action=start]').click();await control.waitForTimeout(150);assert.ok((await control.evaluate(()=>window.timerAPI.get())).elapsed>0);await control.locator('[data-action=reset]').click();}
 await audio.evaluate(()=>localStorage.setItem('audio-test-mode','normal'));await audio.reload();await audio.waitForFunction(()=>Boolean(window.__audioProbe));await control.evaluate(()=>window.timerAPI.settings({soundType:'dog',soundVolume:50}));await control.locator('#sound-preview').click();await audio.waitForFunction(()=>__audioProbe.mediaResolved>0);
 await control.evaluate(()=>window.timerAPI.settings({duration:2,mode:'solid',solid:'#ac83ff',thickness:20,sound:true,soundType:'buzzer',soundVolume:50}));await control.locator('[data-action=start]').click();
 await control.waitForTimeout(250);await control.evaluate(()=>window.timerAPI.command('pause'));const elapsed=await control.evaluate(async()=>(await window.timerAPI.get()).elapsed);await control.waitForTimeout(200);assert.equal(await control.evaluate(async()=>(await window.timerAPI.get()).elapsed),elapsed);
 await control.evaluate(()=>window.timerAPI.command('resume'));await overlay.waitForFunction(()=>document.querySelector('output').textContent==='00:00',null,{timeout:10000});assert.equal((await control.evaluate(()=>window.timerAPI.get())).completed,true);
 await control.evaluate(()=>window.timerAPI.command('reset'));assert.equal((await control.evaluate(()=>window.timerAPI.get())).elapsed,0);
 await control.screenshot({path:'test-results/desktop-portable-control.png'});
 await writeFile('test-results/desktop-portable-report.json',JSON.stringify({launch:'actual Presentation-Frame-Timer-Portable.exe',platform:process.platform,checks:['portable extraction/startup','packaged control and overlay windows','v1.3.0 duration inputs actually visible and functional','start/pause/resume/reset/finish synchronization','sound ON with rejected and permanently pending resume','bundled dog sample playback API']},null,2));console.log('Actual Windows portable EXE smoke test passed');
}finally{
 // A remote CDP Browser.close may terminate Electron before replying and leave
 // an unsettled promise. Disconnect first, then terminate only our launcher tree.
 if(browser)await browser.close();
 if(child.pid){try{execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});}catch{}}
}
