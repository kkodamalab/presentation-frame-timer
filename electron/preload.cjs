const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('timerAPI',Object.freeze({
 get:()=>ipcRenderer.invoke('timer:get'),
 command:action=>ipcRenderer.invoke('timer:command',action),
 settings:patch=>ipcRenderer.invoke('timer:settings',patch),
 display:id=>ipcRenderer.invoke('timer:display',id),
 onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('timer:state',listener);return ()=>ipcRenderer.removeListener('timer:state',listener);}
}));
