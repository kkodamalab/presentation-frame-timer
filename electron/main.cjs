const {app,BrowserWindow,screen,ipcMain,Tray,Menu,nativeImage}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {State,validate}=require('./state.cjs');
const fs=require('node:fs');
const {validBounds,fitBounds,controlArea,initialBounds}=require('./window-geometry.cjs');
const timeKeys=['showTime','fontSize','timeColor','position','timeOpacity','timeMargin'];
const persistedKeys=['sound','soundType','soundVolume','soundDuration','blink','blinkDuration',...timeKeys];
let boundsFile,savedBounds=null,boundsTimer,autoFitControl=true,userSized=false,settingBounds=false,expectedSize=null,contentHeight=0;
function loadControlBounds(){boundsFile=path.join(app.getPath('userData'),'window-state.json');try{const saved=JSON.parse(fs.readFileSync(boundsFile,'utf8'));if(validBounds(saved.bounds)){savedBounds=saved.bounds;userSized=saved.userSized!==false;}}catch{}}
function saveControlBounds(){if(!control||control.isDestroyed())return;try{const bounds=control.getNormalBounds();fs.mkdirSync(path.dirname(boundsFile),{recursive:true});fs.writeFileSync(boundsFile+'.tmp',JSON.stringify({bounds,userSized}),{mode:0o600});fs.renameSync(boundsFile+'.tmp',boundsFile);}catch{}}
function scheduleBoundsSave(){clearTimeout(boundsTimer);boundsTimer=setTimeout(saveControlBounds,200);}
function applyControlBounds(bounds,area){const next=fitBounds(bounds,area);expectedSize=next;settingBounds=true;try{control.setMinimumSize(Math.min(480,area.width),Math.min(320,area.height));control.setBounds(next);}finally{settingBounds=false;}}

const state=new State();let control,overlay,audioWindow,tray,selected,quitting=false,interval,audioReady=false,queuedAudio=null,audioSequence=0,completionHandled=false;
let audioStatus={level:'info',message:'音声は試聴・START操作で準備できます。'},audioSettingsFile;
function loadAudioSettings(){
 audioSettingsFile=path.join(app.getPath('userData'),'audio-settings.json');
 try{const saved=JSON.parse(fs.readFileSync(audioSettingsFile,'utf8'));const patch={};for(const key of persistedKeys)if(Object.hasOwn(saved,key))patch[key]=saved[key];validate(patch);state.update(patch);}
 catch(error){if(error.code!=='ENOENT')audioStatus={level:'warning',message:'音声設定を読み込めなかったため、初期値を使用します。'};}
}
function saveAudioSettings(){
 try{const saved=Object.fromEntries(persistedKeys.map(key=>[key,state.settings[key]]));fs.mkdirSync(path.dirname(audioSettingsFile),{recursive:true});fs.writeFileSync(audioSettingsFile+'.tmp',JSON.stringify(saved),{mode:0o600});fs.renameSync(audioSettingsFile+'.tmp',audioSettingsFile);}
 catch{audioStatus={level:'warning',message:'音声設定を保存できません。現在のタイマーは継続します。'};}
}
function sendAudio(kind){
 const request={kind,id:++audioSequence,soundType:state.settings.soundType,soundVolume:state.settings.soundVolume,soundDuration:state.settings.soundDuration};
 if(!audioWindow||audioWindow.isDestroyed()){audioStatus={level:'warning',message:'音声ウィンドウが利用できません。タイマーは継続します。'};return;}
 if(!audioReady){queuedAudio=request;return;}
 audioWindow.webContents.send('audio:request',request);
}
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
function relocateControl(){
 const all=screen.getAllDisplays(),bounds=control.getNormalBounds(),matched=controlArea(all,bounds,selected),other=all.find(d=>d.id!==selected);
 const target=other&&matched.id===selected?other:matched;
 const next=target.id!==matched.id?{...bounds,x:target.workArea.x+16,y:target.workArea.y+16}:{...bounds};
 if(!userSized){next.width=Math.min(1180,target.workArea.width-32);if(contentHeight)next.height=contentHeight+control.getBounds().height-control.getContentBounds().height;}
 applyControlBounds(next,target.workArea);
}

function place(){const d=current();selected=d.id;overlay.setBounds(d.bounds);overlay.setAlwaysOnTop(true,'screen-saver');overlay.setIgnoreMouseEvents(true,{forward:true});if(state.settings.visible)overlay.showInactive();else overlay.hide();}
function broadcast(){if(!control||!overlay)return;const snapshot=state.snapshot();if(snapshot.completed&&!completionHandled){completionHandled=true;if(snapshot.settings.sound)sendAudio('finish');}if(!snapshot.completed)completionHandled=false;const value={...snapshot,displayId:selected,displays:displays(),audioStatus};for(const w of [control,overlay])if(!w.isDestroyed())w.webContents.send('timer:state',value);return value;}
function showControl(){const area=controlArea(screen.getAllDisplays(),control.getNormalBounds(),selected).workArea;applyControlBounds(control.getNormalBounds(),area);control.show();control.focus();}
function installIPC(){
 function trusted(event,write=false){const wc=event.sender;const allowed=write?[control]:[control,overlay];if(!allowed.some(w=>w&&w.webContents===wc)||event.senderFrame!==wc.mainFrame)throw Error('Unauthorized sender');}
 ipcMain.handle('control:content-size',(e,size)=>{trusted(e,true);if(!size||!Number.isFinite(size.height)||size.height<1||size.height>20000)throw Error('Invalid content size');contentHeight=Math.ceil(size.height);if(autoFitControl){const bounds=control.getBounds(),area=controlArea(screen.getAllDisplays(),bounds,selected).workArea;const chrome=control.getBounds().height-control.getContentBounds().height;applyControlBounds({...bounds,height:Math.ceil(size.height+chrome)},area);}return control.getBounds();});
 ipcMain.handle('timer:get',e=>{trusted(e);return broadcast();});
 ipcMain.handle('timer:command',(e,action)=>{trusted(e,true);state.command(action);if(action==='reset')sendAudio('stop');return broadcast();});
 ipcMain.handle('timer:settings',(e,patch)=>{trusted(e,true);state.update(patch);if(Object.hasOwn(patch,'duration'))sendAudio('stop');if(persistedKeys.some(key=>Object.hasOwn(patch,key)))saveAudioSettings();if((Object.hasOwn(patch,'soundVolume')&&patch.soundVolume===0)||(Object.hasOwn(patch,'sound')&&!patch.sound))sendAudio('stop');place();return broadcast();});
 ipcMain.handle('audio:arm',e=>{trusted(e,true);sendAudio('arm');});
 ipcMain.handle('audio:preview',e=>{trusted(e,true);sendAudio('preview');});
 ipcMain.handle('audio:status',(e,status)=>{if(e.sender!==audioWindow.webContents||e.senderFrame!==e.sender.mainFrame)throw Error('Unauthorized sender');if(!status||!['info','warning'].includes(status.level)||typeof status.message!=='string'||status.message.length>500)throw Error('Invalid audio status');audioStatus={level:status.level,message:status.message};});
 ipcMain.handle('timer:display',(e,id)=>{trusted(e,true);if(!Number.isSafeInteger(id)||!screen.getAllDisplays().some(d=>d.id===id))throw Error('Unknown display');selected=id;place();relocateControl();return broadcast();});
}
if(!app.requestSingleInstanceLock())app.quit();else {
 app.on('second-instance',()=>{if(control)showControl();});
 app.whenReady().then(()=>{
  // All renderer resources are local; deny network requests, including redirects.
  const {session}=require('electron');
  session.defaultSession.webRequest.onBeforeRequest((details,cb)=>{let allowed=false;try{const u=new URL(details.url);allowed=u.protocol==='file:'&&require('node:url').fileURLToPath(u).startsWith(root+path.sep);}catch{}cb({cancel:!allowed});});
  loadAudioSettings();loadControlBounds();autoFitControl=!userSized;
  selected=screen.getPrimaryDisplay().id;
  overlay=new BrowserWindow({...current().bounds,transparent:true,backgroundColor:'#00000000',frame:false,alwaysOnTop:true,skipTaskbar:true,focusable:false,resizable:false,hasShadow:false,show:false,webPreferences:prefs()});
  overlay.setIgnoreMouseEvents(true,{forward:true});
  const candidate=savedBounds&&!userSized?{...savedBounds,width:Math.min(1180,controlArea(screen.getAllDisplays(),savedBounds,selected).workArea.width-32)}:savedBounds;
  const initial=initialBounds(screen.getAllDisplays(),selected,candidate),initialArea=controlArea(screen.getAllDisplays(),initial,selected).workArea;
  control=new BrowserWindow({...initial,minWidth:Math.min(480,initialArea.width),minHeight:Math.min(320,initialArea.height),resizable:true,show:false,title:'Frame Timer — 操作',webPreferences:prefs()});
  expectedSize=initial;control.once('ready-to-show',()=>control.show());control.on('resize',()=>{const b=control.getNormalBounds();if(!settingBounds&&expectedSize&&(b.width!==expectedSize.width||b.height!==expectedSize.height)){userSized=true;autoFitControl=false;}scheduleBoundsSave();});control.on('move',scheduleBoundsSave);
  control.on('close',e=>{if(!quitting){e.preventDefault();saveControlBounds();control.hide();}});
  audioWindow=new BrowserWindow({width:1,height:1,show:false,skipTaskbar:true,focusable:false,webPreferences:{...prefs(),autoplayPolicy:'no-user-gesture-required'}});
  audioWindow.webContents.on('did-finish-load',()=>{audioReady=true;if(queuedAudio){audioWindow.webContents.send('audio:request',queuedAudio);queuedAudio=null;}});
  audioWindow.webContents.on('render-process-gone',()=>{audioReady=false;audioStatus={level:'warning',message:'音声処理が停止しました。アプリを再起動してください。タイマーは継続します。'};});
  audioWindow.webContents.on('did-fail-load',()=>{audioStatus={level:'warning',message:'音声処理を読み込めませんでした。タイマーは継続します。'};});
  installIPC();secure(audioWindow,'audio');secure(overlay,'overlay');secure(control,'control');place();
  // A raw bitmap avoids Windows SVG icon support differences.
  const pixels=Buffer.alloc(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,edge=x<5||x>26||y<5||y>26;pixels[i]=edge?255:40;pixels[i+1]=edge?133:28;pixels[i+2]=edge?67:16;pixels[i+3]=255;}
  tray=new Tray(nativeImage.createFromBitmap(pixels,{width:32,height:32}));tray.setToolTip('Presentation Frame Timer');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'操作パネルを表示',click:showControl},{label:'オーバーレイ表示切替',click:()=>{state.update({visible:!state.settings.visible});place();broadcast();}},{type:'separator'},{label:'終了',click:()=>app.quit()}]));tray.on('double-click',showControl);
  for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,()=>{place();relocateControl();broadcast();});
  interval=setInterval(broadcast,50);
 });
 app.on('before-quit',()=>{quitting=true;clearInterval(interval);clearTimeout(boundsTimer);saveControlBounds();});
 app.on('window-all-closed',()=>app.quit());
}
