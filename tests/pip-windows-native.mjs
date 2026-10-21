import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
export async function verifyNativePiP({page,pip,channel}){
 const ps=code=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8'}).trim();
 const id=Number(ps("$p=Start-Process -FilePath (Join-Path $env:SystemRoot 'System32/notepad.exe') -PassThru; $p.WaitForInputIdle(10000)|Out-Null; $p.Id"));assert.ok(Number.isInteger(id)&&id>0);
 const native=`Add-Type @'
using System;
using System.Runtime.InteropServices;
public class NativeWindow {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int cmd);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
'@;
`;
 const results=[];
 try{
  await page.selectOption('#web-overlay-mode','frame');await page.selectOption('#color-mode','solid');await page.locator('#solid-color').fill('#ff0000');await page.locator('#thickness').fill('20');await page.locator('#opacity').fill('100');await page.locator('#show-time').uncheck();await page.locator('#scrub').fill('100');
  for(const background of ['dark','transparent','solid']){
   await page.selectOption('#web-overlay-background',background);if(background==='solid')await page.locator('#web-overlay-color').fill('#234567');
   const metrics=await pip.evaluate(()=>({x:screenX,y:screenY,width:outerWidth,height:outerHeight,innerWidth,innerHeight,cssBackground:getComputedStyle(document.body).backgroundColor}));
   const foreground=ps(native+`$p=Get-Process -Id ${id}; $p.Refresh(); [NativeWindow]::ShowWindow($p.MainWindowHandle,3)|Out-Null; (New-Object -ComObject WScript.Shell).AppActivate(${id})|Out-Null; [NativeWindow]::SetForegroundWindow($p.MainWindowHandle)|Out-Null; Start-Sleep -Milliseconds 500; ([NativeWindow]::GetForegroundWindow() -eq $p.MainWindowHandle)`);
   assert.equal(foreground,'True','independent Notepad is the actual foreground application');
   const file=path.resolve(`test-results/pip-${channel}-windows-${background}.png`);
   ps(`Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Windows.Forms; $r=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $b=New-Object System.Drawing.Bitmap($r.Width,$r.Height); $g=[System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($r.X,$r.Y,0,0,$b.Size); $b.Save('${file.replaceAll("'","''")}',[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $b.Dispose();`);
   const encoded=(await readFile(file)).toString('base64');
   const pixels=await pip.evaluate(async({encoded,metrics})=>{const img=new Image();img.src='data:image/png;base64,'+encoded;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const {data}=ctx.getImageData(0,0,c.width,c.height);let red=0;for(let i=0;i<data.length;i+=4)if(data[i]>240&&data[i+1]<20&&data[i+2]<20)red++;const x=Math.round(metrics.x+metrics.width/2),y=Math.round(metrics.y+metrics.height/2);return {red,center:[...ctx.getImageData(x,y,1,1).data]};},{encoded,metrics});
   assert.ok(pixels.red>1000,'PiP gauge is visible in OS desktop screenshot above foreground Notepad');
   if(background==='dark')assert.deepEqual(pixels.center.slice(0,3),[16,20,28]);
   if(background==='solid')assert.deepEqual(pixels.center.slice(0,3),[35,69,103]);
   results.push({background,foregroundNotepad:true,metrics,pixels});
  }
 }finally{ps(`Stop-Process -Id ${id} -Force -ErrorAction SilentlyContinue`);}
 return {underlying:'independent maximized Windows Notepad, actual foreground verified with user32',results,transparencyConclusion:'CSS transparency requested; native center pixels recorded. No claim of native transparency or click-through.'};
}
