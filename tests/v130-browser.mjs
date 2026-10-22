import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,...(process.env.PIP_CHANNEL?{channel:process.env.PIP_CHANNEL}:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
await mkdir('test-results',{recursive:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173');
 const gauges=await page.evaluate(async()=>{
  const {drawGauge}=await import('/gauge.js'),{drawGauge:before}=await import('/tests/fixtures/gauge-v1.2.0.js');const rows=[];
  for(const [w,h] of [[1920,1080],[1080,1920]])for(const dpr of [1,1.25,1.5,2])for(const thickness of [3,20,40])for(const mode of ['gradient','solid'])for(const p of [0,.25,.5,.75,1]){
   const c=document.createElement('canvas');c.width=w*dpr;c.height=h*dpr;const ctx=c.getContext('2d');drawGauge(ctx,w,h,dpr,{thickness,mode,start:'#4385ff',end:'#f45b65',solid:'#4385ff'},p);
   const alpha=(x,y)=>ctx.getImageData(x,y,1,1).data[3],corners=[[0,0],[c.width-1,0],[c.width-1,c.height-1],[0,c.height-1]].map(([x,y])=>alpha(x,y));
   let holes=0;if(p===1){const n=Math.floor(thickness*dpr);for(const [sx,sy] of [[0,0],[c.width-n,0],[c.width-n,c.height-n],[0,c.height-n]]){const data=ctx.getImageData(sx,sy,n,n).data;for(let i=3;i<data.length;i+=4)if(data[i]!==255)holes++;}}
   rows.push({w,h,dpr,thickness,mode,p,corners,holes,center:alpha(c.width/2,c.height/2)});
  }
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const ctx=canvas.getContext('2d');before(ctx,1920,1080,1,{thickness:20,mode:'gradient',start:'#4385ff',end:'#f45b65'},1);const oldCorners=[[0,0],[1919,0],[1919,1079],[0,1079]].map(([x,y])=>ctx.getImageData(x,y,1,1).data[3]);return {rows,oldCorners};
 });
 for(const r of gauges.rows){assert.equal(r.center,0);if(r.p===0)assert.deepEqual(r.corners,[0,0,0,0]);if(r.p===1){assert.deepEqual(r.corners,[255,255,255,255],JSON.stringify(r));assert.equal(r.holes,0,JSON.stringify(r));}}
 assert.deepEqual(gauges.oldCorners,[0,0,0,0]);
 // Pixelated 12x magnification of all four corners, before/after, same colors.
 for(const version of ['before','after']){
  await page.evaluate(async version=>{document.querySelector('main').style.display='none';document.querySelectorAll('body > canvas').forEach(e=>e.remove());document.body.style.cssText='margin:0;background:#333;display:flex;gap:12px';const {drawGauge}=await import(version==='before'?'/tests/fixtures/gauge-v1.2.0.js':'/gauge.js');const c=document.createElement('canvas');c.width=1920;c.height=1080;drawGauge(c.getContext('2d'),1920,1080,1,{thickness:20,mode:'gradient',start:'#4385ff',end:'#f45b65'},1);for(const [x,y] of [[0,0],[1888,0],[1888,1048],[0,1048]]){const crop=document.createElement('canvas');crop.width=crop.height=32;crop.getContext('2d').drawImage(c,x,y,32,32,0,0,32,32);crop.style.cssText='width:384px;height:384px;image-rendering:pixelated';document.body.append(crop);}},version);
  await page.setViewportSize({width:1600,height:410});await page.screenshot({path:`test-results/desktop-gauge-corners-${version}.png`});
 }
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173');
 // Actual OfflineAudioContext waveforms: no signal past requested deadline,
 // repeated phrases late in the interval, peak bounded at all common volumes.
 const waves=await page.evaluate(async()=>{const {scheduleSound}=await import('/audio-engine.js');const rows=[];for(const duration of [1,5,30,60])for(const type of ['buzzer','bell','alert','chime','digital'])for(const volume of [0,50,100]){const ctx=new OfflineAudioContext(1,Math.ceil((duration+.2)*8000),8000);scheduleSound(ctx,type,volume,duration);const data=(await ctx.startRendering()).getChannelData(0);let peak=0,late=0,tail=0;for(let i=0;i<data.length;i++){const a=Math.abs(data[i]);peak=Math.max(peak,a);if(i>(duration-.7)*8000&&i<duration*8000)late=Math.max(late,a);if(i>(duration+.08)*8000)tail=Math.max(tail,a);}rows.push({duration,type,volume,peak,late,tail});}return rows;});
 for(const w of waves){assert.ok(w.peak<=.51,JSON.stringify(w));assert.ok(w.tail<.0001,JSON.stringify(w));if(w.volume===0)assert.equal(w.peak,0);else assert.ok(w.late>0,JSON.stringify(w));}
 // Browser timer UI uses wall time, including the exact finish deadline. Fast
 // forward browser clocks only; audio waveform timing above uses real Web Audio.
 await page.clock.install();
 for(const blinkDuration of [1,4,30,60]){
  await page.locator('#reset').click();await page.locator('#minutes').fill('0');await page.locator('#seconds').fill('1');await page.locator('#apply-time').click();await page.locator('#blink').check();await page.locator('#sound').uncheck();await page.locator('#blink-duration').fill(String(blinkDuration));await page.locator('#sound-duration').fill(blinkDuration===1?'60':'1');await page.locator('#start').click();await page.clock.fastForward(1100);assert.equal(await page.locator('#gauge').evaluate(e=>e.classList.contains('blink')),true);await page.clock.fastForward(blinkDuration*1000);assert.equal(await page.locator('#gauge').evaluate(e=>e.classList.contains('blink')),false);await page.locator('#reset').click();assert.equal(await page.locator('#gauge').evaluate(e=>e.classList.contains('blink')),false);
 }
 assert.deepEqual(errors,[]);await writeFile(`test-results/desktop-v130-browser-${process.env.PIP_CHANNEL||'chromium'}.json`,JSON.stringify({gaugeCases:gauges.rows.length,gauges,waveformCases:waves.length,waves,blinkDurations:[1,4,30,60],blinkClock:'browser wall-clock fast-forward',actualSpeakerVerified:false,errors},null,2));console.log('v1.3 browser:',gauges.rows.length,'pixel cases;',waves.length,'real offline waveforms; 4 blink duration cases');
}finally{await browser.close();}
