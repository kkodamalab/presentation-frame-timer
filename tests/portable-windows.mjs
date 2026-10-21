// Launch the actual portable EXE, not the unpacked app or NSIS installer.
import {chromium} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
if(process.platform!=='win32')throw Error('Windows required');
const exe=path.resolve('release/Presentation-Frame-Timer-Portable.exe');
const child=spawn(exe,['--remote-debugging-port=9223'],{stdio:'ignore'});let browser,spawnError;
child.on('error',e=>{spawnError=e;});
try{
 let ready=false;for(let i=0;i<120;i++){if(spawnError)throw spawnError;try{const response=await fetch('http://127.0.0.1:9223/json/version');if(response.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,'portable EXE started its Chromium debugging endpoint');
 browser=await chromium.connectOverCDP('http://127.0.0.1:9223');const context=browser.contexts()[0];let control,overlay;
 for(let i=0;i<80;i++){control=context.pages().find(p=>p.url().endsWith('/control.html'));overlay=context.pages().find(p=>p.url().endsWith('/overlay.html'));if(control&&overlay)break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(control&&overlay,'portable control and overlay windows');await control.waitForFunction(()=>document.querySelector('#display').options.length>0);
 assert.match(control.url(),/app\.asar/,'portable executes packaged application');
 await control.evaluate(async()=>{await window.timerAPI.settings({duration:2,mode:'solid',solid:'#ac83ff',thickness:20});await window.timerAPI.command('start');});
 await control.waitForTimeout(250);await control.evaluate(()=>window.timerAPI.command('pause'));const elapsed=await control.evaluate(async()=>(await window.timerAPI.get()).elapsed);await control.waitForTimeout(200);assert.equal(await control.evaluate(async()=>(await window.timerAPI.get()).elapsed),elapsed);
 await control.evaluate(()=>window.timerAPI.command('resume'));await overlay.waitForFunction(()=>document.querySelector('output').textContent==='00:00',null,{timeout:10000});assert.equal((await control.evaluate(()=>window.timerAPI.get())).completed,true);
 await control.evaluate(()=>window.timerAPI.command('reset'));assert.equal((await control.evaluate(()=>window.timerAPI.get())).elapsed,0);
 await control.screenshot({path:'test-results/desktop-portable-control.png'});
 await writeFile('test-results/desktop-portable-report.json',JSON.stringify({launch:'actual Presentation-Frame-Timer-Portable.exe',platform:process.platform,checks:['portable extraction/startup','packaged control and overlay windows','start/pause/resume/reset/finish synchronization']},null,2));console.log('Actual Windows portable EXE smoke test passed');
}finally{
 if(browser){try{const cdp=await browser.newBrowserCDPSession();await cdp.send('Browser.close');}catch{}await browser.close();}
 if(child.pid){try{execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});}catch{}}
}
