import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1250},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base);await page.evaluate(()=>document.fonts.ready);
async function seek(p){await page.locator('#scrub').fill(String(p));await page.waitForTimeout(80);}
const report=[];
for(const p of [0,10,25,50,75,100]){
 await seek(p);await page.locator('#stage').screenshot({path:`test-results/gauge-${p}.png`});
 const stats=await page.locator('#gauge').evaluate((c,p)=>{const ctx=c.getContext('2d'),{width:w,height:h}=c,{data}=ctx.getImageData(0,0,w,h);let count=0;const mask=new Uint8Array(w*h);for(let i=0;i<mask.length;i++)if(data[i*4+3]>100){mask[i]=1;count++;}let components=0;for(let i=0;i<mask.length;i++)if(mask[i]){components++;const stack=[i];mask[i]=0;while(stack.length){const n=stack.pop(),x=n%w,y=Math.floor(n/w);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&mask[j]){mask[j]=0;stack.push(j);}}}}return {p,count,components};},p);
 assert.equal(stats.components,p===0?0:1,`single connected gauge at ${p}%`);report.push(stats);
}
await page.screenshot({path:'test-results/desktop.png',fullPage:true});
const colors=await page.locator('#gauge').evaluate(c=>{const ctx=c.getContext('2d');return [[20,4],[c.width-5,c.height/2],[20,c.height-5],[4,20]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data]);});
assert.ok(colors[0][2]>colors[0][0],'start stays blue');assert.ok(colors[1][1]>colors[1][0],'right edge cyan/green');assert.ok(colors[2][0]>colors[2][2],'bottom yellow');assert.ok(colors[3][0]>colors[3][2],'end red');
await page.selectOption('#color-mode','solid');await page.locator('[data-color="#ac83ff"]').click();await page.locator('#thickness').fill('20');await seek(75);
assert.equal(await page.locator('#thickness-value').textContent(),'20 px');
const solid=await page.locator('#gauge').evaluate(c=>{const d=c.getContext('2d').getImageData(50,10,1,1).data;return [...d];});assert.deepEqual(solid.slice(0,3),[172,131,255]);
await page.locator('#stage').screenshot({path:'test-results/solid-thick.png'});
await page.locator('#fullscreen').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);await page.screenshot({path:'test-results/fullscreen.png'});await page.evaluate(()=>document.exitFullscreen());
await page.locator('#minutes').fill('0');await page.locator('#seconds').fill('2');await page.locator('#apply-time').click();await page.locator('#start').click();await page.waitForTimeout(300);await page.locator('#start').click();const paused=await page.locator('#percent').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('#percent').textContent(),paused);assert.match(await page.locator('#start').textContent(),/RESUME/);await page.locator('#start').click();await page.waitForTimeout(2200);assert.equal(await page.locator('#remaining').textContent(),'00:00');assert.equal(await page.locator('#state').textContent(),'終了');
await page.locator('#reset').click();assert.equal(await page.locator('#percent').textContent(),'0%');
await page.locator('#show-demo').uncheck();assert.equal(await page.locator('#scrub-wrap').isVisible(),false);await page.reload();assert.equal(await page.locator('#show-demo').isChecked(),false);assert.equal(await page.locator('#thickness').inputValue(),'20');
await page.locator('#show-demo').check();await page.selectOption('#color-mode','gradient');await page.locator('#thickness').fill('6');await page.locator('[data-min="10"]').click();await seek(75);
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-results/mobile.png',fullPage:true});await page.locator('#stage').screenshot({path:'test-results/mobile-gauge.png'});
await page.locator('#overlay').click();assert.equal(await page.locator('#overlay-dialog').isVisible(),true);await page.locator('#close-dialog').click();
await page.goto(new URL('?mode=obs&duration=1',base).href);await page.waitForTimeout(1300);assert.equal(await page.locator('#remaining').textContent(),'00:00');assert.equal(await page.locator('.scene').isVisible(),false);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
assert.deepEqual(errors,[]);await writeFile('test-results/report.json',JSON.stringify({base,report,checks:['connected pixels at all progress points','solid color','20px thickness','fullscreen API','pause/resume/finish/reset','settings persistence','mobile resize/no overflow','overlay guide','OBS transparent mode'],errors},null,2));console.log('Browser checks passed',report);await browser.close();
