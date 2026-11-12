const {randomUUID}=require('node:crypto');
// Readiness is a conjunction, never Electron's first-paint notification alone.
class Startup {
 constructor({timeoutMs=8000,retryMs=150,onRetry,onReady,onFailure,log=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}={}){Object.assign(this,{timeoutMs,retryMs,onRetry,onReady,onFailure,log,setTimer,clearTimer});this.state='idle';this.attempt=0;this.token=null;}
 begin(reset=false){this.cancel();if(reset)this.attempt=0;this.token=randomUUID();this.loaded=false;this.preloaded=false;this.initialized=false;this.state='loading';const token=this.token;this.log('startup-begin',{attempt:this.attempt});this.timer=this.setTimer(()=>this.fail('UI_TIMEOUT',{timeoutMs:this.timeoutMs},token),this.timeoutMs);return token;}
 preload(){this.preloaded=true;this.check();}
 load(){this.loaded=true;this.check();}
 ready(token){if(token!==this.token||this.state!=='loading')return false;this.initialized=true;this.check();return true;}
 check(){if(this.state==='loading'&&this.loaded&&this.preloaded&&this.initialized){this.cancel();this.state='ready';this.log('ui-ready',{attempt:this.attempt});this.onReady?.();}}
 fail(code,details={},token=this.token){if(token!==this.token||!['loading','ready'].includes(this.state))return;this.cancel();this.log('ui-failed',{code,...details,loaded:this.loaded,preloaded:this.preloaded,initialized:this.initialized,attempt:this.attempt});if(this.attempt===0){this.attempt=1;this.state='retrying';this.timer=this.setTimer(()=>this.onRetry?.(code),this.retryMs);}else{this.state='failed';this.onFailure?.(code,details);}}
 cancel(){if(this.timer){this.clearTimer(this.timer);this.timer=null;}}
 close(){this.cancel();this.state='closed';}
}
class LayoutBudget {
 constructor(){this.reset();}
 reset(){this.changes=0;this.limited=false;}
 accept(current,next){if(['x','y','width','height'].every(k=>Math.abs(current[k]-next[k])<=1))return false;if(this.changes>=4){this.limited=true;return false;}this.changes++;return true;}
}
module.exports={Startup,LayoutBudget};
