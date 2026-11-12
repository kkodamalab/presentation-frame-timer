const {app,BrowserWindow,screen,ipcMain,Tray,Menu,nativeImage,dialog,shell}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {State,validate}=require('./state.cjs');
const fs=require('node:fs');
const {Startup,LayoutBudget}=require('./startup.cjs');
const {isLocalResource,createDiagnostics}=require('./diagnostics.cjs');
const APP_VERSION=require('../package.json').version;
let diagnostics,startup,recovery,recoveryURL='',nativeErrorShown=false,expectedControlCrash=false;const layoutBudget=new LayoutBudget();
const log=(event,data)=>diagnostics?.write(event,data);

const {validBounds,fitBounds,controlArea,initialBounds}=require('./window-geometry.cjs');
const timeKeys=['showTime','fontSize','timeColor','position','timeOpacity','timeMargin'];
const persistedKeys=['sound','soundType','soundVolume','soundDuration','blink','blinkDuration',...timeKeys];
let boundsFile,savedBounds=null,boundsTimer,autoFitControl=true,userSized=false,settingBounds=false,expectedSize=null,contentHeight=0;
function loadControlBounds(){boundsFile=path.join(app.getPath('userData'),'window-state.json');try{const saved=JSON.parse(fs.readFileSync(boundsFile,'utf8'));if(validBounds(saved.bounds)){savedBounds=saved.bounds;userSized=saved.userSized!==false;}}catch(error){if(error.code!=='ENOENT')log('window-state-invalid',{message:error.message});savedBounds=null;userSized=false;}}
function saveControlBounds(){if(!control||control.isDestroyed()||startup?.state!=='ready')return;try{const bounds=control.getNormalBounds();fs.mkdirSync(path.dirname(boundsFile),{recursive:true});fs.writeFileSync(boundsFile+'.tmp',JSON.stringify({bounds,userSized}),{mode:0o600});fs.renameSync(boundsFile+'.tmp',boundsFile);}catch{}}
function scheduleBoundsSave(){clearTimeout(boundsTimer);boundsTimer=setTimeout(saveControlBounds,200);}
function applyControlBounds(bounds,area){
 const next=fitBounds(bounds,area),current=control.getBounds();expectedSize=next;
 if(['x','y','width','height'].every(k=>Math.abs(current[k]-next[k])<=1))return false;
 settingBounds=true;try{const minimum=[Math.min(480,area.width),Math.min(320,area.height)];if(control.getMinimumSize().some((v,i)=>v!==minimum[i]))control.setMinimumSize(...minimum);control.setBounds(next);}finally{settingBounds=false;}return true;
}
function fitContent(height){
 if(!Number.isFinite(height)||height<1||height>20000){log('layout-fallback',{reason:'invalid-content-height'});return;}
 contentHeight=Math.ceil(height);if(!autoFitControl)return;
 try{const bounds=control.getBounds(),area=controlArea(screen.getAllDisplays(),bounds,selected).workArea,chrome=Math.max(0,bounds.height-control.getContentBounds().height),next=fitBounds({...bounds,height:contentHeight+chrome},area);
 if(layoutBudget.accept(bounds,next)){log('layout-change',{current:bounds,next,contentHeight,chrome,changes:layoutBudget.changes});applyControlBounds(next,area);}else if(layoutBudget.limited){autoFitControl=false;log('layout-fallback',{reason:'convergence-limit',changes:layoutBudget.changes});}
 }catch(error){autoFitControl=false;log('layout-fallback',{reason:error.message});}
}


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
 win.webContents.on('did-finish-load',broadcast);
 if(name==='control')loadControl(true);else win.loadFile(path.join(__dirname,name+'.html')).catch(error=>log('resource-load-failed',{page:name,message:error.message}));
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
function broadcast(){if(!control||!overlay)return;const snapshot=state.snapshot();if(snapshot.completed&&!completionHandled){completionHandled=true;if(snapshot.settings.sound)sendAudio('finish');}if(!snapshot.completed)completionHandled=false;const value={...snapshot,displayId:selected,displays:displays(),audioStatus,startupToken:startup?.token};for(const w of [control,overlay])if(!w.isDestroyed()&&(w!==control||startup?.state==='ready'))w.webContents.send('timer:state',value);return value;}
function showControl(){if(startup?.state!=='ready'){if(startup?.state==='failed')showRecovery('UI_NOT_READY');return;}const area=controlArea(screen.getAllDisplays(),control.getNormalBounds(),selected).workArea;applyControlBounds(control.getNormalBounds(),area);control.show();control.focus();}
function resetWindowBounds(){
 log('window-state-reset');try{if(fs.existsSync(boundsFile))fs.renameSync(boundsFile,boundsFile+'.reset-'+Date.now());}catch(error){log('window-state-reset-error',{message:error.message});}
 savedBounds=null;userSized=false;autoFitControl=true;layoutBudget.reset();
 try{const b=initialBounds(screen.getAllDisplays(),selected,null),a=controlArea(screen.getAllDisplays(),b,selected).workArea;applyControlBounds(b,a);}catch(error){log('layout-fallback',{reason:error.message});}
 loadControl(true);
}
function loadControl(reset=false){
 if(quitting||!control||control.isDestroyed())return;
 if(recovery&&!recovery.isDestroyed())recovery.destroy();nativeErrorShown=false;
 layoutBudget.reset();autoFitControl=!userSized;control.hide();const token=startup.begin(reset);
 control.loadFile(path.join(__dirname,'control.html')).catch(error=>startup.fail('LOAD_FILE_REJECTED',{message:error.message},token));
}
function showInitializedControl(){
 // Windows can add DPI-dependent nonclient insets when a hidden HWND is first
 // mapped. Reapply the intended outer DIP bounds after mapping, before reporting
 // startup ready to callers. Do not interpret this adjustment as a user resize.
 const wanted=control.getBounds(),area=controlArea(screen.getAllDisplays(),wanted,selected).workArea;
 settingBounds=true;try{control.show();const mapped=control.getBounds();if(['x','y','width','height'].some(k=>Math.abs(mapped[k]-wanted[k])>1))log('post-show-bounds',{wanted,mapped});applyControlBounds(wanted,area);}finally{settingBounds=false;}
 saveControlBounds();broadcast();
}
function watchControl(){
 startup=new Startup({log,onReady:showInitializedControl,onRetry:code=>{control.hide();log('startup-retry',{code});if(['RENDERER_UNRESPONSIVE','UI_TIMEOUT'].includes(code)&&!control.webContents.isDestroyed()){expectedControlCrash=true;try{control.webContents.forcefullyCrashRenderer();}catch{expectedControlCrash=false;}}loadControl();},onFailure:showRecovery});
 control.once('ready-to-show',()=>log('ready-to-show',{readinessProof:false}));
 const wc=control.webContents;
 wc.on('did-start-navigation',(_e,url,inPlace,isMainFrame)=>{if(isMainFrame&&!inPlace&&startup.state==='ready'){control.hide();layoutBudget.reset();startup.begin();}if(isMainFrame)log('navigation-start',{url});});
 wc.on('did-finish-load',()=>{log('did-finish-load',{url:wc.getURL()});startup.load();});
 wc.on('did-fail-load',(_e,code,description,url,isMainFrame)=>{log('did-fail-load',{code,description,url,isMainFrame});if(isMainFrame&&code!==-3)startup.fail('DID_FAIL_LOAD',{code,description,url});});
 wc.on('preload-error',(_e,file,error)=>{log('preload-error',{file,message:error.message});startup.fail('PRELOAD_ERROR');});
 wc.on('render-process-gone',(_e,details)=>{log('render-process-gone',details);if(expectedControlCrash){expectedControlCrash=false;return;}startup.fail('RENDER_PROCESS_GONE',details);});
 wc.on('unresponsive',()=>{log('renderer-unresponsive');startup.fail('RENDERER_UNRESPONSIVE');});
 wc.on('console-message',(event,level,message,line,source)=>{const d=event.message!==undefined?event:{level,message,lineNumber:line,sourceId:source};if(d.level==='error'||d.level===3)log('console-error',{message:d.message,line:d.lineNumber,source:d.sourceId});});
}
function showRecovery(code){
 if(quitting)return;control?.hide();log('recovery-shown',{code});
 if(recovery&&!recovery.isDestroyed()){recovery.show();return;}
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; base-uri 'none'"><title>Frame Timer — 起動エラー</title><style>body{margin:28px;background:#101827;color:#e7edf8;font:15px/1.6 system-ui}h1{font-size:22px}a{display:inline-block;padding:10px;margin:6px 10px 6px 0;background:#24324b;color:#a9edcb;border-radius:5px}code{overflow-wrap:anywhere}</style></head><body><h1>操作画面を起動できませんでした</h1><p>FRAME TIMER v${escape(APP_VERSION)}</p><p>コード：<code id="failure-code">${escape(code)}</code></p><p>タイマー・音声設定は削除していません。再試行するか、ウィンドウの配置情報だけを初期化できます。</p><a id="retry" href="timer-recovery://retry">再試行</a><a id="reset-bounds" href="timer-recovery://reset-bounds">配置だけ初期化</a><a id="open-log" href="timer-recovery://open-log">診断ログを開く</a><p>診断ログ：ユーザーデータ内の diagnostics/startup.log。ログの自動送信は行いません。</p></body></html>`;
 recoveryURL='data:text/html;charset=utf-8,'+encodeURIComponent(html);
 const a=screen.getPrimaryDisplay().workArea,b=fitBounds({x:a.x+20,y:a.y+20,width:680,height:460},a);
 recovery=new BrowserWindow({...b,backgroundColor:'#101827',title:'Frame Timer — 起動エラー',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 recovery.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 recovery.webContents.on('will-navigate',(event,url)=>{event.preventDefault();if(url==='timer-recovery://retry')loadControl(true);else if(url==='timer-recovery://reset-bounds')resetWindowBounds();else if(url==='timer-recovery://open-log')shell.showItemInFolder(diagnostics.logPath);});
 const nativeFailure=()=>{if(nativeErrorShown||quitting)return;nativeErrorShown=true;log('native-error-fallback',{code});void dialog.showMessageBox({type:'error',title:'Frame Timer — 起動エラー',message:'操作画面の読み込みに失敗しました。',detail:`コード: ${code}\n診断ログ: ${diagnostics?.logPath||'保存できませんでした'}\nトレイから再試行できます。`,buttons:['閉じる']});};
 recovery.webContents.on('render-process-gone',nativeFailure);recovery.webContents.on('did-fail-load',nativeFailure);
 recovery.loadURL(recoveryURL).catch(nativeFailure);
}
function installIPC(){
 function trusted(event,write=false){const wc=event.sender;const allowed=write?[control]:[control,overlay];if(!allowed.some(w=>w&&w.webContents===wc)||event.senderFrame!==wc.mainFrame)throw Error('Unauthorized sender');}
 ipcMain.on('control:preload-ready',e=>{if(e.sender===control.webContents&&e.senderFrame===e.sender.mainFrame){log('preload-ready');startup.preload();}});
 ipcMain.on('control:renderer-error',(e,error)=>{if(e.sender!==control.webContents||e.senderFrame!==e.sender.mainFrame)return;if(!error||typeof error.message!=='string')return;log('renderer-exception',{kind:String(error.kind).slice(0,80),message:error.message.slice(0,1000),source:String(error.source||'').slice(0,1000),line:error.line,column:error.column,stack:String(error.stack||'').slice(0,2000)});startup.fail(error.kind==='resource-error'?'RESOURCE_ERROR':'JAVASCRIPT_ERROR');});
 ipcMain.on('control:failed',(e,payload)=>{if(e.sender!==control.webContents||e.senderFrame!==e.sender.mainFrame)return;log('ui-initialization-failed',{code:String(payload?.code||'UNKNOWN').slice(0,300)});startup.fail(String(payload?.code||'UI_INITIALIZATION_FAILED').slice(0,100),{},payload?.token||startup.token);});
 ipcMain.handle('control:ready',(e,payload)=>{trusted(e,true);if(!payload||payload.token!==startup.token)return false;if(payload.theme!=='dark'){startup.fail('CONTROL_CSS_UNAVAILABLE');return false;}fitContent(payload.height);return startup.ready(payload.token);});
 ipcMain.handle('control:content-size',(e,size)=>{trusted(e,true);if(!size||!Number.isFinite(size.height)||size.height<1||size.height>20000)throw Error('Invalid content size');fitContent(size.height);return control.getBounds();});
 ipcMain.handle('timer:get',e=>{trusted(e);return broadcast();});
 ipcMain.handle('timer:command',(e,action)=>{trusted(e,true);state.command(action);if(action==='reset')sendAudio('stop');return broadcast();});
 ipcMain.handle('timer:settings',(e,patch)=>{trusted(e,true);state.update(patch);if(Object.hasOwn(patch,'duration'))sendAudio('stop');if(persistedKeys.some(key=>Object.hasOwn(patch,key)))saveAudioSettings();if((Object.hasOwn(patch,'soundVolume')&&patch.soundVolume===0)||(Object.hasOwn(patch,'sound')&&!patch.sound))sendAudio('stop');place();return broadcast();});
 ipcMain.handle('audio:arm',e=>{trusted(e,true);sendAudio('arm');});
 ipcMain.handle('audio:preview',e=>{trusted(e,true);sendAudio('preview');});
 ipcMain.handle('audio:status',(e,status)=>{if(e.sender!==audioWindow.webContents||e.senderFrame!==e.sender.mainFrame)throw Error('Unauthorized sender');if(!status||!['info','warning'].includes(status.level)||typeof status.message!=='string'||status.message.length>500)throw Error('Invalid audio status');audioStatus={level:status.level,message:status.message};});
 ipcMain.handle('timer:display',(e,id)=>{trusted(e,true);if(!Number.isSafeInteger(id)||!screen.getAllDisplays().some(d=>d.id===id))throw Error('Unknown display');selected=id;place();relocateControl();return broadcast();});
}
if(!app.requestSingleInstanceLock())app.quit();else {
 app.on('child-process-gone',(_e,details)=>log('child-process-gone',details));
 app.on('second-instance',()=>{if(control)showControl();});
 app.whenReady().then(()=>{
  // All renderer resources are local; deny network requests, including redirects.
  diagnostics=createDiagnostics(app.getPath('userData'),root,APP_VERSION);log('application-start',{platform:process.platform});try{log('graphics-status',{features:app.getGPUFeatureStatus()});}catch(error){log('graphics-status-unavailable',{message:error.message});}
  const {session}=require('electron');
  session.defaultSession.webRequest.onBeforeRequest((details,cb)=>{const allowed=isLocalResource(details.url,root)||(recovery&&!recovery.isDestroyed()&&details.webContentsId===recovery.webContents.id&&details.url===recoveryURL);if(!allowed)log('request-denied',{url:details.url});cb({cancel:!allowed});});
  loadAudioSettings();loadControlBounds();autoFitControl=!userSized;
  selected=screen.getPrimaryDisplay().id;
  overlay=new BrowserWindow({...current().bounds,transparent:true,backgroundColor:'#00000000',frame:false,alwaysOnTop:true,skipTaskbar:true,focusable:false,resizable:false,hasShadow:false,show:false,webPreferences:prefs()});
  overlay.setIgnoreMouseEvents(true,{forward:true});
  const candidate=savedBounds&&!userSized?{...savedBounds,width:Math.min(1180,controlArea(screen.getAllDisplays(),savedBounds,selected).workArea.width-32)}:savedBounds;
  const initial=initialBounds(screen.getAllDisplays(),selected,candidate),initialArea=controlArea(screen.getAllDisplays(),initial,selected).workArea;
  control=new BrowserWindow({...initial,minWidth:Math.min(480,initialArea.width),minHeight:Math.min(320,initialArea.height),resizable:true,show:false,backgroundColor:'#101827',title:'Frame Timer — 操作',webPreferences:prefs()});
  expectedSize=initial;watchControl();log('window-created',{bounds:initial,workArea:initialArea,scaleFactor:screen.getDisplayMatching(initial).scaleFactor,userSized});control.on('resize',()=>{const b=control.getNormalBounds();if(!settingBounds&&expectedSize&&(Math.abs(b.width-expectedSize.width)>1||Math.abs(b.height-expectedSize.height)>1)){userSized=true;autoFitControl=false;}scheduleBoundsSave();});control.on('move',scheduleBoundsSave);
  control.on('close',e=>{if(!quitting){e.preventDefault();saveControlBounds();control.hide();}});
  audioWindow=new BrowserWindow({width:1,height:1,show:false,skipTaskbar:true,focusable:false,webPreferences:{...prefs(),autoplayPolicy:'no-user-gesture-required'}});
  audioWindow.webContents.on('did-finish-load',()=>{audioReady=true;if(queuedAudio){audioWindow.webContents.send('audio:request',queuedAudio);queuedAudio=null;}});
  audioWindow.webContents.on('render-process-gone',()=>{audioReady=false;audioStatus={level:'warning',message:'音声処理が停止しました。アプリを再起動してください。タイマーは継続します。'};});
  audioWindow.webContents.on('did-fail-load',()=>{audioStatus={level:'warning',message:'音声処理を読み込めませんでした。タイマーは継続します。'};});
  installIPC();secure(audioWindow,'audio');secure(overlay,'overlay');secure(control,'control');place();
  // A raw bitmap avoids Windows SVG icon support differences.
  const pixels=Buffer.alloc(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,edge=x<5||x>26||y<5||y>26;pixels[i]=edge?255:40;pixels[i+1]=edge?133:28;pixels[i+2]=edge?67:16;pixels[i+3]=255;}
  tray=new Tray(nativeImage.createFromBitmap(pixels,{width:32,height:32}));tray.setToolTip('Presentation Frame Timer');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'操作パネルを表示',click:showControl},{label:'操作画面を再試行',click:()=>loadControl(true)},{label:'ウィンドウ配置だけ初期化',click:resetWindowBounds},{label:'診断ログを開く',click:()=>shell.showItemInFolder(diagnostics.logPath)},{label:'オーバーレイ表示切替',click:()=>{state.update({visible:!state.settings.visible});place();broadcast();}},{type:'separator'},{label:'終了',click:()=>app.quit()}]));tray.on('double-click',showControl);
  for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,()=>{layoutBudget.reset();autoFitControl=!userSized;place();relocateControl();broadcast();});
  interval=setInterval(broadcast,50);
 }).catch(error=>{log('main-startup-error',{message:error.stack||error.message});showRecovery('MAIN_STARTUP_ERROR');});
 app.on('before-quit',()=>{quitting=true;clearInterval(interval);clearTimeout(boundsTimer);saveControlBounds();startup?.close();});
 app.on('window-all-closed',()=>app.quit());
}
