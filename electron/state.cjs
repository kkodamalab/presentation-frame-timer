const defaults = Object.freeze({duration:600,mode:'gradient',start:'#4385ff',end:'#f45b65',solid:'#4385ff',thickness:6,opacity:90,showTime:true,blink:false,sound:false,visible:true});
function validate(patch) {
 if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('Invalid settings');
 for (const [key,value] of Object.entries(patch)) {
  if (!(Object.hasOwn(defaults,key))) throw Error('Unknown setting');
  if (['duration','thickness','opacity'].includes(key)) {const [min,max]=key==='duration'?[1,7200]:key==='thickness'?[3,40]:[5,100];if(!Number.isFinite(value)||value<min||value>max)throw Error('Out of range');}
  else if(key==='mode'){if(!['gradient','solid'].includes(value))throw Error('Invalid mode');}
  else if(['start','end','solid'].includes(key)){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw Error('Invalid color');}
  else if(typeof value!=='boolean') throw Error('Invalid boolean');
 }
 return patch;
}
class State {
 constructor(now=()=>performance.now()){this.now=now;this.settings={...defaults};this.elapsed=0;this.started=null;this.completed=false;}
 value(){return Math.min(this.settings.duration*1000,this.elapsed+(this.started===null?0:Math.max(0,this.now()-this.started)));}
 command(action){if(!['start','pause','resume','reset'].includes(action))throw Error('Invalid action');if(action==='reset'){this.elapsed=0;this.started=null;this.completed=false;}else if(action==='pause'){this.elapsed=this.value();this.started=null;}else if(this.started===null&&!this.completed){this.started=this.now();}}
 update(patch){validate(patch);if('duration' in patch&&patch.duration!==this.settings.duration)this.command('reset');Object.assign(this.settings,patch);}
 snapshot(){const elapsed=this.value();if(elapsed>=this.settings.duration*1000){this.elapsed=elapsed;this.started=null;this.completed=true;}return {settings:{...this.settings},elapsed,running:this.started!==null,completed:this.completed};}
}
module.exports={State,validate,defaults};
