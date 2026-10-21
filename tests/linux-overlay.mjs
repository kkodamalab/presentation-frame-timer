// Optional Linux/X11 native input check. Not a substitute for Windows testing.
import {_electron as electron,chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
if(process.platform!=='linux'||!process.env.DISPLAY)throw Error('Requires Linux X11 desktop');
await mkdir('test-results',{recursive:true});
const app=await electron.launch({args:['.'],env:{...process.env}});
let browser;
try{
 let control;for(let i=0;i<100;i++){control=app.windows().find(p=>p.url().endsWith('/control.html'));if(control)break;await new Promise(r=>setTimeout(r,100));}
 await control.waitForFunction(()=>document.querySelector('#display').options.length>0);
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:false,args:['--start-fullscreen']});
 const page=await browser.newPage({viewport:null});await page.setContent('<html><style>html,body{margin:0;background:#203040;color:white;height:3000px}#target{position:fixed;inset:0;background:transparent;color:white;border:0}</style><button id="target">Independent Chromium — native click/scroll target</button><script>window.clicks=0;window.wheels=0;document.addEventListener("click",()=>window.clicks++);document.addEventListener("wheel",()=>window.wheels++);</script></html>');
 const cdp=await page.context().newCDPSession(page);const {windowId}=await cdp.send('Browser.getWindowForTarget');await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'fullscreen'}});
 await control.evaluate(async()=>{await window.timerAPI.settings({duration:2,mode:'solid',solid:'#ff0000',thickness:20,opacity:100,showTime:false});await window.timerAPI.command('start');});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/control.html')).close());
 await page.bringToFront();
 await new Promise(r=>setTimeout(r,2500));
 execFileSync('python3',['-c',`import ctypes,time
x=ctypes.CDLL('libX11.so.6');t=ctypes.CDLL('libXtst.so.6')
x.XOpenDisplay.restype=ctypes.c_void_p
x.XFlush.argtypes=[ctypes.c_void_p]
t.XTestFakeMotionEvent.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_ulong]
t.XTestFakeButtonEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]
d=x.XOpenDisplay(None)
if not d: raise RuntimeError('XOpenDisplay failed')
for px,py in [(650,500),(15,500)]:
 t.XTestFakeMotionEvent(d,-1,px,py,0);x.XFlush(d);time.sleep(.15)
 for b in [1,5]:
  t.XTestFakeButtonEvent(d,b,1,0);t.XTestFakeButtonEvent(d,b,0,0);x.XFlush(d);time.sleep(.15)
`]);
 const counts=await page.evaluate(()=>({clicks:window.clicks,wheels:window.wheels}));console.log(counts);
 execFileSync('ffmpeg',['-y','-loglevel','error','-f','x11grab','-video_size','1364x1024','-i',process.env.DISPLAY,'-frames:v','1','test-results/desktop-native-linux.png']);
 assert.equal(counts.clicks,2);assert.equal(counts.wheels,2);
 await writeFile('test-results/desktop-native-linux.json',JSON.stringify({platform:'Linux X11 / Xorg dummy + xfwm4 compositor',underlying:'separate Chromium process; fullscreen requested via CDP',input:'XTest OS pointer events at center and left gauge',...counts,limitations:['Not Windows','No Zoom or PowerPoint','No physical monitor changes']},null,2));console.log('Native Linux click-through and scrolling passed',counts);
}finally{if(browser)await browser.close();await app.close();}
