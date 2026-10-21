const {app,BrowserWindow,screen,ipcMain,Tray,Menu,nativeImage}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {State}=require('./state.cjs');
const state=new State();let control,overlay,tray,selected,quitting=false,interval;
const root=path.resolve(__dirname,'..');
const pageURL=name=>pathToFileURL(path.join(__dirname,name+'.html')).href;
function secure(win,name){
 const expected=pageURL(name);
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(url!==expected)e.preventDefault();});
 win.webContents.session.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));
 win.webContents.on('will-attach-webview',e=>e.preventDefault());
 win.loadFile(path.join(__dirname,name+'.html'));
 win.webContents.on('did-finish-load',broadcast);
}
function prefs(){return {preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false};}
function displays(){return screen.getAllDisplays().map((d,i)=>({id:d.id,label:d.label||`モニター ${i+1}`,bounds:d.bounds,scaleFactor:d.scaleFactor,primary:d.id===screen.getPrimaryDisplay().id}));}
function current(){return screen.getAllDisplays().find(d=>d.id===selected)||screen.getPrimaryDisplay();}
function relocateControl(){const target=current(),other=screen.getAllDisplays().find(d=>d.id!==target.id);if(other){const a=other.workArea;control.setBounds({x:a.x+20,y:a.y+20,width:Math.min(430,a.width),height:Math.min(720,a.height)});}}
function place(){const d=current();selected=d.id;overlay.setBounds(d.bounds);overlay.setAlwaysOnTop(true,'screen-saver');overlay.setIgnoreMouseEvents(true,{forward:true});if(state.settings.visible)overlay.showInactive();else overlay.hide();}
function broadcast(){if(!control||!overlay)return;const value={...state.snapshot(),displayId:selected,displays:displays()};for(const w of [control,overlay])if(!w.isDestroyed())w.webContents.send('timer:state',value);return value;}
function showControl(){control.show();control.focus();}
function installIPC(){
 function trusted(event,write=false){const wc=event.sender;const allowed=write?[control]:[control,overlay];if(!allowed.some(w=>w&&w.webContents===wc)||event.senderFrame!==wc.mainFrame)throw Error('Unauthorized sender');}
 ipcMain.handle('timer:get',e=>{trusted(e);return broadcast();});
 ipcMain.handle('timer:command',(e,action)=>{trusted(e,true);state.command(action);return broadcast();});
 ipcMain.handle('timer:settings',(e,patch)=>{trusted(e,true);state.update(patch);place();return broadcast();});
 ipcMain.handle('timer:display',(e,id)=>{trusted(e,true);if(!Number.isSafeInteger(id)||!screen.getAllDisplays().some(d=>d.id===id))throw Error('Unknown display');selected=id;place();relocateControl();return broadcast();});
}
if(!app.requestSingleInstanceLock())app.quit();else {
 app.on('second-instance',()=>{if(control)showControl();});
 app.whenReady().then(()=>{
  // All renderer resources are local; deny network requests, including redirects.
  const {session}=require('electron');
  session.defaultSession.webRequest.onBeforeRequest((details,cb)=>{let allowed=false;try{const u=new URL(details.url);allowed=u.protocol==='file:'&&require('node:url').fileURLToPath(u).startsWith(root+path.sep);}catch{}cb({cancel:!allowed});});
  selected=screen.getPrimaryDisplay().id;
  overlay=new BrowserWindow({...current().bounds,transparent:true,backgroundColor:'#00000000',frame:false,alwaysOnTop:true,skipTaskbar:true,focusable:false,resizable:false,hasShadow:false,show:false,webPreferences:prefs()});
  overlay.setIgnoreMouseEvents(true,{forward:true});
  control=new BrowserWindow({width:430,height:720,minWidth:360,minHeight:500,title:'Frame Timer — 操作',webPreferences:prefs()});
  control.on('close',e=>{if(!quitting){e.preventDefault();control.hide();}});
  secure(overlay,'overlay');secure(control,'control');installIPC();place();relocateControl();
  // A raw bitmap avoids Windows SVG icon support differences.
  const pixels=Buffer.alloc(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,edge=x<5||x>26||y<5||y>26;pixels[i]=edge?255:40;pixels[i+1]=edge?133:28;pixels[i+2]=edge?67:16;pixels[i+3]=255;}
  tray=new Tray(nativeImage.createFromBitmap(pixels,{width:32,height:32}));tray.setToolTip('Presentation Frame Timer');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'操作パネルを表示',click:showControl},{label:'オーバーレイ表示切替',click:()=>{state.update({visible:!state.settings.visible});place();broadcast();}},{type:'separator'},{label:'終了',click:()=>app.quit()}]));tray.on('double-click',showControl);
  for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,()=>{place();relocateControl();broadcast();});
  interval=setInterval(broadcast,50);
 });
 app.on('before-quit',()=>{quitting=true;clearInterval(interval);});
 app.on('window-all-closed',()=>app.quit());
}
