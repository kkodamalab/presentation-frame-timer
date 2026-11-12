const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('timerAPI',Object.freeze({
 armAudio:()=>ipcRenderer.invoke('audio:arm'),
 previewAudio:()=>ipcRenderer.invoke('audio:preview'),
 audioStatus:status=>ipcRenderer.invoke('audio:status',status),
 onAudioRequest:callback=>{const listener=(_e,request)=>callback(request);ipcRenderer.on('audio:request',listener);return ()=>ipcRenderer.removeListener('audio:request',listener);},
 startupReady:payload=>ipcRenderer.invoke('control:ready',payload),
 startupFailed:payload=>ipcRenderer.send('control:failed',payload),
 contentSize:size=>ipcRenderer.invoke('control:content-size',size),
 get:()=>ipcRenderer.invoke('timer:get'),
 command:action=>ipcRenderer.invoke('timer:command',action),
 settings:patch=>ipcRenderer.invoke('timer:settings',patch),
 display:id=>ipcRenderer.invoke('timer:display',id),
 onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('timer:state',listener);return ()=>ipcRenderer.removeListener('timer:state',listener);}
}));

// Install before any page script, including when module imports fail.
ipcRenderer.send('control:preload-ready');
window.addEventListener('error',event=>{const resource=event.target;ipcRenderer.send('control:renderer-error',{kind:resource&&resource!==window?'resource-error':'javascript-error',message:String(event.message||'Resource failed'),source:String(event.filename||resource?.src||resource?.href||''),line:event.lineno,column:event.colno,stack:String(event.error?.stack||'').slice(0,2000)});},true);
window.addEventListener('unhandledrejection',event=>ipcRenderer.send('control:renderer-error',{kind:'unhandled-rejection',message:String(event.reason?.message||event.reason||'Unknown rejection')}));
