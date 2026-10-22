// Shared by the native overlay, Web, PiP and scaled settings previews.
export const TIME_POSITIONS=Object.freeze([
 ['top-left','左上'],['top-center','上中央'],['top-right','右上'],
 ['middle-left','左中央'],['middle-center','中央'],['middle-right','右中央'],
 ['bottom-left','左下'],['bottom-center','下中央'],['bottom-right','右下']
]);
export function populatePositions(select){select.replaceChildren(...TIME_POSITIONS.map(([value,label])=>{const option=select.ownerDocument.createElement('option');option.value=value;option.textContent=label;return option;}));}
export function timeLayout(width,height,textWidth,textHeight,position,margin){
 const w=Math.min(Math.max(0,textWidth),width),h=Math.min(Math.max(0,textHeight),height),[row,col]=position.split('-');
 const x=col==='center'?(width-w)/2:col==='right'?width-margin-w:margin;
 const y=row==='middle'?(height-h)/2:row==='bottom'?height-margin-h:margin;
 return {x:Math.max(0,Math.min(width-w,x)),y:Math.max(0,Math.min(height-h,y)),width:w,height:h};
}
export function applyTimeDisplay(element,settings,width,height){
 element.hidden=!settings.showTime;
 element.style.fontSize=Math.min(settings.fontSize,Math.max(1,height/1.2),Math.max(1,width/4))+'px';
 element.style.color=settings.timeColor;element.style.opacity=String(settings.timeOpacity/100);
 element.style.fontVariantNumeric='tabular-nums';
 element.style.margin='0';element.style.boxSizing='border-box';element.style.maxWidth=width+'px';element.style.maxHeight=height+'px';element.style.whiteSpace='nowrap';element.style.overflow='hidden';
 element.style.right='auto';element.style.bottom='auto';element.style.transform='none';
 // Computed CSS dimensions retain subpixel precision and stay unscaled in
 // the preview; offsetWidth would round and let a zero-margin glyph overflow.
 const css=element.ownerDocument.defaultView.getComputedStyle(element);
 const bounds=timeLayout(width,height,parseFloat(css.width)||element.offsetWidth,parseFloat(css.height)||element.offsetHeight,settings.position,settings.timeMargin);
 element.style.left=bounds.x+'px';element.style.top=bounds.y+'px';element.dataset.position=settings.position;
 return bounds;
}
export function updateTimePreview(container,element,settings,text,width,height){
 const w=Math.max(1,width),h=Math.max(1,height),scale=Math.min(container.clientWidth/w,140/h);
 container.style.height=h*scale+2+'px';
 const surface=element.parentElement;surface.style.left=(container.clientWidth-w*scale)/2+'px';surface.style.width=w+'px';surface.style.height=h+'px';surface.style.transform=`scale(${scale})`;
 element.textContent=text;applyTimeDisplay(element,settings,w,h);
}
