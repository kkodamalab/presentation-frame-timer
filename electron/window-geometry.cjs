// Electron screen bounds and workArea are already DIP; never multiply scaleFactor.
function validBounds(b){return b&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.width>0&&b.height>0&&Math.abs(b.x)<1e7&&Math.abs(b.y)<1e7;}
function fitBounds(b,a){const width=Math.max(Math.min(480,a.width),Math.min(Math.round(b.width),a.width)),height=Math.max(Math.min(320,a.height),Math.min(Math.round(b.height),a.height));return {x:Math.round(Math.max(a.x,Math.min(a.x+a.width-width,b.x))),y:Math.round(Math.max(a.y,Math.min(a.y+a.height-height,b.y))),width,height};}
function intersection(b,a){return Math.max(0,Math.min(b.x+b.width,a.x+a.width)-Math.max(b.x,a.x))*Math.max(0,Math.min(b.y+b.height,a.y+a.height)-Math.max(b.y,a.y));}
function controlArea(displays,bounds,projectionId){
 if(validBounds(bounds)){const match=[...displays].sort((a,b)=>intersection(bounds,b.workArea)-intersection(bounds,a.workArea))[0];if(match&&intersection(bounds,match.workArea)>0)return match;}
 return displays.find(d=>d.id!==projectionId)||displays.find(d=>d.id===projectionId)||displays[0];
}
function initialBounds(displays,projectionId,saved){const d=controlArea(displays,saved,projectionId),a=d.workArea;return fitBounds(validBounds(saved)?saved:{x:a.x+16,y:a.y+16,width:Math.min(1180,a.width-32),height:Math.min(720,a.height)},a);}
module.exports={validBounds,fitBounds,controlArea,initialBounds};
