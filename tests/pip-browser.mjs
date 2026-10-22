import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {verifyNativePiP} from './pip-windows-native.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const channel=process.env.PIP_CHANNEL,tag=channel||'chromium';
const launch=channel?{channel}:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{};
const browser=await chromium.launch({...launch,headless:false});
await mkdir('test-results',{recursive:true});
const errors=[],checks=[];
const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const context=await browser.newContext({viewport:null});const page=await context.newPage();
context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base);assert.equal(await page.evaluate(()=>typeof window.documentPictureInPicture?.requestWindow),'function',`${tag} actual Document PiP support`);
 await page.locator('#web-overlay-mode').selectOption('frame');
 const next=context.waitForEvent('page');await page.locator('#web-overlay').click();let pip=await next;await pip.waitForSelector('#pip-gauge');await pip.waitForFunction(()=>document.querySelector('link')?.sheet);
 assert.equal(await pip.locator('button,input,select').count(),0);checks.push('actual PiP requestWindow from click, no app controls in PiP');
 const ratios=[];
 for(const mode of ['gradient','solid']){
  await page.selectOption('#color-mode',mode);if(mode==='solid')await page.locator('[data-color="#ac83ff"]').click();
  for(const percent of [0,25,50,75,100]){
   await page.locator('#scrub').fill(String(percent));await pip.waitForFunction(p=>Math.abs(Number(document.querySelector('svg').dataset.progress)-p/100)<.0001,percent);
   const stats=await pip.locator('svg').evaluate(async(svg)=>{const xml=new XMLSerializer().serializeToString(svg),img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml);await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const {data}=ctx.getImageData(0,0,c.width,c.height),mask=new Uint8Array(c.width*c.height);for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>100?1:0;let components=0;for(let i=0;i<mask.length;i++)if(mask[i]){components++;const stack=[i];mask[i]=0;while(stack.length){const n=stack.pop(),x=n%c.width,y=Math.floor(n/c.width);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const xx=x+dx,yy=y+dy,j=yy*c.width+xx;if(xx>=0&&xx<c.width&&yy>=0&&yy<c.height&&mask[j]){mask[j]=0;stack.push(j);}}}}return {components,width:c.width,height:c.height,centerAlpha:ctx.getImageData(c.width/2,c.height/2,1,1).data[3],paths:svg.querySelectorAll('path').length};});
   assert.equal(stats.components,percent===0?0:1);assert.equal(stats.centerAlpha,0);assert.equal(stats.paths,1);ratios.push({mode,percent,...stats});
  }
 }
 checks.push('single SVG mask path and connected rendered pixels at 0/25/50/75/100%, both colors');
 const cdp=await context.newCDPSession(pip);const {windowId}=await cdp.send('Browser.getWindowForTarget');const sizes=[];
 for(const [width,height]of [[480,300],[700,440]]){await cdp.send('Browser.setWindowBounds',{windowId,bounds:{width,height}});await pip.waitForTimeout(250);const size=await pip.evaluate(()=>{const svg=document.querySelector('svg');return {w:innerWidth,h:innerHeight,viewBox:svg.getAttribute('viewBox'),perimeter:Number(svg.dataset.perimeter)};});assert.equal(size.viewBox,`0 0 ${size.w} ${size.h}`);assert.ok(Math.abs(size.perimeter-2*(size.w+size.h-4*(6/2)))<.01);sizes.push(size);}
 assert.notDeepEqual([sizes[0].w,sizes[0].h],[sizes[1].w,sizes[1].h]);checks.push('actual PiP native resizing updates SVG dimensions/perimeter');
 await page.selectOption('#web-overlay-mode','compact');assert.equal(await pip.locator('body').getAttribute('data-mode'),'compact');
 await page.selectOption('#web-overlay-background','solid');await page.locator('#web-overlay-color').fill('#234567');assert.equal(await pip.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(35, 69, 103)');
 await page.selectOption('#web-overlay-background','transparent');assert.equal(await pip.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');assert.match(await page.locator('#web-overlay-status').textContent(),/保証/);
 await page.selectOption('#web-overlay-background','dark');checks.push('COMPACT/FRAME, solid/dark and experimental CSS-transparent alternatives');
 await page.locator('#thickness').fill('20');assert.equal(await pip.locator('mask path').getAttribute('fill'),'white');assert.ok((await pip.locator('mask path').getAttribute('d')).includes('20'));await page.locator('#opacity').fill('50');assert.equal(await pip.locator('svg').evaluate(e=>e.style.opacity),'0.5');
 await page.locator('#show-time').uncheck();assert.equal(await pip.locator('output').isVisible(),false);await page.locator('#show-time').check();await page.selectOption('#position','bottom-left');assert.equal(await pip.locator('output').getAttribute('data-position'),'bottom-left');checks.push('color/thickness/opacity/showTime/position sync');
 for(const [i,position] of ['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right'].entries()){await page.locator('#position').selectOption(position);await page.locator('#font-size').fill('120');await page.locator('#time-color').fill('#ff5588');await page.locator('#time-margin').fill(String([0,24,100][i%3]));await page.locator('#time-opacity').fill(String([0,50,100][i%3]));const box=await pip.locator('output').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight,color:getComputedStyle(e).color,opacity:e.style.opacity,position:e.dataset.position};});assert.equal(box.position,position);assert.equal(box.color,'rgb(255, 85, 136)');assert.equal(box.opacity,String([0,50,100][i%3]/100));assert.ok(box.left>=0&&box.top>=0&&box.right<=box.w+.1&&box.bottom<=box.h+.1);}
 await page.locator('#font-size').fill('28');await page.locator('#time-opacity').fill('100');checks.push('nine time positions, text size/color/margin/independent opacity');
 await page.locator('#minutes').fill('0');await page.locator('#seconds').fill('6');await page.locator('#apply-time').click();await page.locator('#start').click();await pip.waitForTimeout(300);await page.locator('#start').click();
 const paused=await pip.locator('svg').getAttribute('data-progress');await pip.waitForTimeout(300);assert.equal(await pip.locator('svg').getAttribute('data-progress'),paused);
 await page.locator('#start').click();const otherTab=await context.newPage();await otherTab.setContent('<p>Another browser tab</p>');await otherTab.bringToFront();await pip.bringToFront();const openerVisibility=await page.evaluate(()=>document.visibilityState);await pip.waitForTimeout(350);assert.ok(Number(await pip.locator('svg').getAttribute('data-progress'))>Number(paused));
 await pip.close();await page.bringToFront();await page.waitForTimeout(250);assert.match(await page.locator('#web-overlay-status').textContent(),/維持/);assert.match(await page.locator('#start').textContent(),/PAUSE/);
 const reopen=context.waitForEvent('page');await page.locator('#web-overlay').click();pip=await reopen;await pip.waitForSelector('svg');assert.ok(Number(await pip.locator('svg').getAttribute('data-progress'))>Number(paused));
 await pip.waitForFunction(()=>document.querySelector('output').textContent==='00:00',null,{timeout:10000});assert.equal(await pip.locator('svg').getAttribute('data-progress'),'1');assert.equal(await page.locator('#state').textContent(),'終了');
 await page.locator('#reset').click();assert.equal(await pip.locator('svg').getAttribute('data-progress'),'0');checks.push('start/pause/resume/reset, live focused PiP, close/reopen retains running elapsed time, 100% stops');
 await page.locator('#seconds').fill('1');await page.locator('#apply-time').click();await page.locator('#blink').check();await page.locator('#blink-duration').fill('1');await page.locator('#sound-duration').fill('5');await page.locator('#start').click();await pip.waitForFunction(()=>document.body.classList.contains('blink'));await pip.waitForFunction(()=>!document.body.classList.contains('blink'));await page.locator('#reset').click();await page.locator('#blink').uncheck();checks.push('PiP real-time 1s blink deadline, independent of 5s sound setting, reset');
 await pip.screenshot({path:`test-results/pip-${tag}-compact.png`});await page.selectOption('#web-overlay-mode','frame');await page.locator('#scrub').fill('75');await pip.screenshot({path:`test-results/pip-${tag}-frame.png`});
 const native=process.env.PIP_NATIVE_CHECK==='1'?await verifyNativePiP({page,pip,channel:tag}):null;
 await pip.close();
 // Controlled negative tests are separate from the real API success above.
 const unsupported=await browser.newContext();await unsupported.addInitScript(()=>Object.defineProperty(window,'documentPictureInPicture',{value:undefined}));const up=await unsupported.newPage();await up.goto(base);await up.click('#web-overlay');assert.match(await up.locator('#web-overlay-status').textContent(),/非対応/);await up.click('#start');assert.match(await up.locator('#start').textContent(),/PAUSE/);await unsupported.close();
 const denied=await browser.newContext();await denied.addInitScript(()=>Object.defineProperty(window,'documentPictureInPicture',{value:{requestWindow(){return Promise.reject(new DOMException('test denial','NotAllowedError'));}}}));const dp=await denied.newPage();await dp.goto(base);await dp.click('#web-overlay');await dp.waitForFunction(()=>document.querySelector('#web-overlay-status').textContent.includes('NotAllowedError'));assert.equal(await dp.locator('#web-overlay').isDisabled(),false);await dp.click('#start');assert.match(await dp.locator('#start').textContent(),/PAUSE/);await denied.close();checks.push('simulated unsupported/denied API preserves ordinary timer');
 assert.deepEqual(errors,[]);await writeFile(`test-results/pip-${tag}-report.json`,JSON.stringify({browser:tag,version:browser.version(),platform:process.platform,base,ratios,sizes,openerVisibility,checks,errors,native,notVerified:['Zoom','PowerPoint','physical Windows PC/multiple monitors','native OS transparency and click-through (not guaranteed)']},null,2));console.log('Document PiP checks passed',tag,browser.version(),checks);
}finally{await browser.close();}
