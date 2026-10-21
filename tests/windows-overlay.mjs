// Real Windows OS input against a separate Edge process. Zoom/PowerPoint and
// physical multi-monitor coverage are deliberately not claimed by this test.
import {_electron as electron,chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
if(process.platform!=='win32')throw Error('Windows desktop required');
await mkdir('test-results',{recursive:true});
const app=await electron.launch({args:['.']});let browser;
function powershell(code){return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8'});}
const native=`Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Pointer {
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,int data,UIntPtr extra);
}
'@;
`;
try{
 let control;for(let i=0;i<100;i++){control=app.windows().find(p=>p.url().endsWith('/control.html'));if(control)break;await new Promise(r=>setTimeout(r,100));}
 await control.waitForFunction(()=>document.querySelector('#display').options.length>0);
 const bounds=await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);
 browser=await chromium.launch({channel:'msedge',headless:false});const page=await browser.newPage({viewport:null});
 await page.setContent('<html><style>html,body{margin:0;background:#203040;color:white;height:3000px}button{position:fixed;inset:0;border:0;background:transparent;color:white;font:24px sans-serif}</style><button>Independent Edge — native input target</button><script>window.clicks=0;window.wheels=0;document.addEventListener("click",()=>window.clicks++);document.addEventListener("wheel",()=>window.wheels++);</script></html>');
 const cdp=await page.context().newCDPSession(page),{windowId}=await cdp.send('Browser.getWindowForTarget');
 await control.evaluate(async()=>{await window.timerAPI.settings({duration:1,mode:'solid',solid:'#ff0000',thickness:24,opacity:100,showTime:false});await window.timerAPI.command('start');});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/control.html')).close());
 await new Promise(r=>setTimeout(r,1500));const results=[];
 for(const windowState of ['normal','maximized','fullscreen']){
  await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
  if(windowState==='normal')await cdp.send('Browser.setWindowBounds',{windowId,bounds:{left:bounds.x+80,top:bounds.y+80,width:Math.min(800,bounds.width-160),height:Math.min(600,bounds.height-160)}});
  else await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState}});
  await page.bringToFront();await page.waitForTimeout(700);
  await page.evaluate(()=>{window.clicks=0;window.wheels=0;});
  const box=await page.evaluate(()=>({x:screenX,y:screenY,w:outerWidth,h:outerHeight}));
  const points=[[Math.round(box.x+box.w/2),Math.round(box.y+box.h/2)]];
  if(windowState!=='normal')points.push([bounds.x+15,bounds.y+Math.round(bounds.height/2)]);
  for(const [x,y]of points)powershell(native+`[Pointer]::SetCursorPos(${x},${y})|Out-Null; Start-Sleep -Milliseconds 150; [Pointer]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [Pointer]::mouse_event(4,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 150; [Pointer]::mouse_event(0x800,0,0,-120,[UIntPtr]::Zero); Start-Sleep -Milliseconds 150;`);
  const counts=await page.evaluate(()=>({clicks:window.clicks,wheels:window.wheels}));assert.equal(counts.clicks,points.length,`${windowState} native clicks`);assert.equal(counts.wheels,points.length,`${windowState} native wheels`);
  const output=path.resolve(`test-results/desktop-windows-${windowState}.png`).replaceAll("'","''");
  powershell(`Add-Type -AssemblyName System.Drawing; $b=New-Object System.Drawing.Bitmap(${bounds.width},${bounds.height}); $g=[System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(${bounds.x},${bounds.y},0,0,$b.Size); $b.Save('${output}',[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $b.Dispose();`);
  results.push({windowState,box,points,...counts});
 }
 await writeFile('test-results/desktop-windows-native.json',JSON.stringify({platform:process.platform,bounds,results,notVerified:['Zoom','PowerPoint','physical multi-monitor and hotplug','exclusive fullscreen','audible sound']},null,2));console.log('Windows Edge native input passed',results);
}finally{if(browser)await browser.close();await app.close();}
