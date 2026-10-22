const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('timerAPI',Object.freeze({
 armAudio:()=>ipcRenderer.invoke('audio:arm'),
 previewAudio:()=>ipcRenderer.invoke('audio:preview'),
 audioStatus:status=>ipcRenderer.invoke('audio:status',status),
 onAudioRequest:callback=>{const listener=(_e,request)=>callback(request);ipcRenderer.on('audio:request',listener);return ()=>ipcRenderer.removeListener('audio:request',listener);},
 contentSize:size=>ipcRenderer.invoke('control:content-size',size),
 get:()=>ipcRenderer.invoke('timer:get'),
 command:action=>ipcRenderer.invoke('timer:command',action),
 settings:patch=>ipcRenderer.invoke('timer:settings',patch),
 display:id=>ipcRenderer.invoke('timer:display',id),
 onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('timer:state',listener);return ()=>ipcRenderer.removeListener('timer:state',listener);}
}));
