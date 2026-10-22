import {_electron as electron} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const launchArgs=process.env.ELECTRON_EXECUTABLE?[]:['.'];
// Linux containers may not permit Chromium's user-namespace sandbox. Never
// pass this flag in the packaged application or on the Windows CI runner.
if(process.env.ELECTRON_TEST_NO_SANDBOX==='1')launchArgs.unshift('--no-sandbox');
const app=await electron.launch({...(process.env.ELECTRON_EXECUTABLE?{executablePath:process.env.ELECTRON_EXECUTABLE}:{}),args:launchArgs,env:{...process.env},timeout:60000});
const errors=[];
try {
 let control,overlay;
 for(let i=0;i<100;i++){for(const page of app.windows()){const url=page.url();if(url.endsWith('/control.html'))control=page;if(url.endsWith('/overlay.html'))overlay=page;}if(control&&overlay)break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(control&&overlay,'both application windows loaded');
 for(const p of [control,overlay])p.on('pageerror',e=>errors.push(e.message));
 await control.waitForFunction(()=>document.querySelector('#display').options.length>0);
 for(const [id,value] of [['soundDuration','7'],['blinkDuration','9']]){assert.equal(await control.locator('#'+id).getAttribute('min'),'1');assert.equal(await control.locator('#'+id).getAttribute('max'),'60');await control.locator('#'+id).fill(value);assert.equal((await control.evaluate(()=>window.timerAPI.get())).settings[id],Number(value));}
 for(const [id,value] of [['fontSize','120'],['timeColor','#ff5588'],['timeOpacity','50'],['timeMargin','100']]){await control.locator('#'+id).fill(value);assert.equal((await control.evaluate(()=>window.timerAPI.get())).settings[id],id==='timeColor'?value:Number(value));}await control.selectOption('#position','middle-center');await overlay.waitForFunction(()=>document.querySelector('output').dataset.position==='middle-center');assert.equal(await overlay.locator('output').evaluate(e=>getComputedStyle(e).color),'rgb(255, 85, 136)');
 const native=await app.evaluate(({BrowserWindow,screen})=>{const ws=BrowserWindow.getAllWindows(),o=ws.find(w=>w.webContents.getURL().endsWith('/overlay.html'));return {bounds:o.getBounds(),display:screen.getAllDisplays().find(d=>d.id===screen.getPrimaryDisplay().id).bounds,top:o.isAlwaysOnTop(),focusable:o.isFocusable(),background:o.getBackgroundColor(),prefs:o.webContents.getLastWebPreferences()};});
 if(process.platform==='linux'){for(const k of ['x','y','width','height'])assert.ok(Math.abs(native.bounds[k]-native.display[k])<=1,`X11 WM bounds ${k}`);}else assert.deepEqual(native.bounds,native.display);assert.equal(native.top,true);assert.equal(native.focusable,false);assert.equal(native.prefs.nodeIntegration,false);assert.equal(native.prefs.contextIsolation,true);assert.equal(native.prefs.sandbox,true);
 assert.equal(await overlay.evaluate(()=>typeof window.require),'undefined');
 assert.equal(await overlay.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
 await assert.rejects(overlay.evaluate(()=>window.timerAPI.command('start')),/Unauthorized/);
 await assert.rejects(control.evaluate(()=>window.timerAPI.settings({duration:0})),/range/);
 await assert.rejects(control.evaluate(()=>window.timerAPI.command('execute')),/Invalid/);
 // Exercise the real shared renderer at exact progress, two aspect ratios and
 // multiple scale factors; inspect pixel connectivity and transparent center.
 const gauges=[];
 for(const [w,h,dpr] of [[1600,900,1],[900,1600,1.5],[1920,1080,2]])for(const mode of ['gradient','solid'])for(const p of [0,.25,.5,.75,1]){
  const stats=await overlay.evaluate(async({w,h,dpr,mode,p})=>{const {drawGauge}=await import('../gauge.js');const c=document.createElement('canvas');c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const ctx=c.getContext('2d');drawGauge(ctx,w,h,dpr,{thickness:20,mode,start:'#4385ff',end:'#f45b65',solid:'#ac83ff'},p);const {data}=ctx.getImageData(0,0,c.width,c.height),mask=new Uint8Array(c.width*c.height);let count=0,components=0;for(let i=0;i<mask.length;i++){if(data[i*4+3]>100){mask[i]=1;count++;}}for(let i=0;i<mask.length;i++)if(mask[i]){components++;const stack=[i];mask[i]=0;while(stack.length){const n=stack.pop(),x=n%c.width,y=Math.floor(n/c.width);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const xx=x+dx,yy=y+dy,j=yy*c.width+xx;if(xx>=0&&xx<c.width&&yy>=0&&yy<c.height&&mask[j]){mask[j]=0;stack.push(j);}}}}return {components,count,center:ctx.getImageData(c.width/2,c.height/2,1,1).data[3]};},{w,h,dpr,mode,p});
  assert.equal(stats.components,p===0?0:1);assert.equal(stats.center,0);gauges.push({w,h,dpr,mode,p,...stats});
 }
 await control.evaluate(()=>window.timerAPI.settings({duration:4,blink:true,opacity:50,thickness:20,mode:'solid',solid:'#ac83ff'}));
 await control.locator('[data-action=start]').click();await control.waitForTimeout(350);await control.locator('[data-action=pause]').click();
 const paused=await control.evaluate(async()=> (await window.timerAPI.get()).elapsed);await control.waitForTimeout(200);assert.equal(await control.evaluate(async()=> (await window.timerAPI.get()).elapsed),paused);
 await control.locator('[data-action=resume]').click();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/control.html')).close());
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/control.html')).isVisible()),false);
 await overlay.waitForFunction(()=>document.querySelector('output').textContent==='00:00',{timeout:10000});
 const done=await control.evaluate(()=>window.timerAPI.get());assert.equal(done.completed,true);assert.equal(done.running,false);assert.equal(done.elapsed,4000);
 assert.equal(await overlay.locator('canvas').evaluate(c=>c.style.opacity),'0.5');
 await overlay.screenshot({path:'test-results/desktop-overlay.png',omitBackground:true});
 await app.evaluate(({app})=>app.emit('second-instance'));
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/control.html')).isVisible()),true);
 await control.locator('#visible').uncheck();assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/overlay.html')).isVisible()),false);
 await control.locator('#visible').check();await control.locator('[data-action=reset]').click();assert.equal((await control.evaluate(()=>window.timerAPI.get())).elapsed,0);
 await control.screenshot({path:'test-results/desktop-control.png'});
 assert.deepEqual(errors,[]);
 await writeFile('test-results/desktop-report.json',JSON.stringify({platform:process.platform,native,gauges,checks:['native windows and display bounds','sandbox/contextIsolation/nodeIntegration','transparent center','single connected gauge at 0/25/50/75/100% in both modes','DPR 1/1.5/2','unauthorized IPC rejected','start/pause/resume/reset/completion','panel close preserves timer; second instance reopens','visibility and opacity'],notVerified:['Zoom','PowerPoint','native OS click-through','physical multi-monitor/DPI hotplug','exclusive fullscreen','audible sound'],errors},null,2));
 console.log('Electron checks passed');
}finally{await app.close();}
