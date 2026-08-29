import { creativeStudioTransformHtml } from "./creativeStudioTransformHtml.js";

function injectAfter(html: string, marker: string, content: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_MULTISELECT_MARKER_MISSING: ${marker}`);
  return html.replace(marker, `${marker}${content}`);
}

function injectBefore(html: string, marker: string, content: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_MULTISELECT_MARKER_MISSING: ${marker}`);
  return html.replace(marker, `${content}${marker}`);
}

export function creativeStudioMultiSelectHtml(): string {
  let html = creativeStudioTransformHtml();

  html = injectAfter(
    html,
    '<div id="properties" class="hidden"></div>',
    `<div id="arrangePanel" class="section" style="margin-top:16px">
      <h3>Arrange</h3>
      <div id="multiSelectionSummary" class="note" style="margin-bottom:8px">Select two or more unlocked layers with Shift/Cmd/Ctrl-click.</div>
      <div class="toolbar-row"><button class="secondary" data-align="left" disabled>Left</button><button class="secondary" data-align="horizontal-center" disabled>Center</button><button class="secondary" data-align="right" disabled>Right</button></div>
      <div class="toolbar-row"><button class="secondary" data-align="top" disabled>Top</button><button class="secondary" data-align="vertical-center" disabled>Middle</button><button class="secondary" data-align="bottom" disabled>Bottom</button></div>
      <div class="toolbar-row"><button class="secondary" data-distribute="horizontal" disabled>Distribute H</button><button class="secondary" data-distribute="vertical" disabled>Distribute V</button></div>
      <div class="toolbar-row"><button id="groupSelectionBtn" class="secondary" disabled>Group</button><button id="ungroupSelectionBtn" class="secondary" disabled>Ungroup</button></div>
      <div class="note">Multi-move, align, distribute and grouping are deterministic DesignDocument operations. One arrange action creates one persisted version and zero model calls.</div>
    </div>`,
  );

  const style = `<style>
    .layer-row.multi-selected{outline:1px solid #52c7ff;background:#17232a}
    #arrangePanel button:disabled{opacity:.38;cursor:not-allowed}
  </style>`;
  html = injectBefore(html, "</head>", style);

  const script = `<script>
(function(){
  'use strict';
  var NS='http://www.w3.org/2000/svg';
  var selectedIds=[],drag=null,raf=0;
  function $(id){return document.getElementById(id);}
  function project(){return window.__creativeStudioCurrentProject&&window.__creativeStudioCurrentProject();}
  function primary(){return window.__creativeStudioSelectedLayer&&window.__creativeStudioSelectedLayer();}
  function status(message,type){if(window.__creativeStudioSetStatus)window.__creativeStudioSetStatus(message,type);}
  async function api(path,options){var response=await fetch(path,Object.assign({headers:{'content-type':'application/json'}},options||{}));var data=await response.json();if(!response.ok)throw new Error(data.error||('HTTP '+response.status));return data;}
  window.__creativeStudioMultiSelectionIds=function(){return selectedIds.slice();};
  function doc(){var p=project();return p&&p.document;}
  function layerById(id){var d=doc();return d&&d.layers.find(function(layer){return layer.id===id;});}
  function chosen(){var d=doc();if(!d)return [];return selectedIds.map(function(id){return d.layers.find(function(layer){return layer.id===id;});}).filter(Boolean);}
  function bounds(layers){var left=Math.min.apply(null,layers.map(function(layer){return layer.x;}));var top=Math.min.apply(null,layers.map(function(layer){return layer.y;}));var right=Math.max.apply(null,layers.map(function(layer){return layer.x+layer.width;}));var bottom=Math.max.apply(null,layers.map(function(layer){return layer.y+layer.height;}));return {x:left,y:top,width:right-left,height:bottom-top};}
  function svgPoint(event){var svg=$('artboard');var point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;var matrix=svg.getScreenCTM();if(!matrix)return {x:0,y:0};var value=point.matrixTransform(matrix.inverse());return {x:value.x,y:value.y};}
  function schedule(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;draw();});}
  function selectPrimary(id){var rows=Array.from(document.querySelectorAll('[data-select-layer]'));var row=rows.find(function(candidate){return candidate.dataset.selectLayer===id;});if(row)row.click();}
  function syncSingle(){if(selectedIds.length>1)return;var layer=primary();if(layer)selectedIds=[layer.id];}
  function parentGroup(id){var d=doc();return d&&d.layers.find(function(layer){return layer.type==='group'&&Array.isArray(layer.childLayerIds)&&layer.childLayerIds.includes(id);});}
  function arrangeable(layers){return layers.length>=2&&layers.every(function(layer){return !layer.locked&&layer.type!=='group'&&layer.type!=='background';});}
  function groupable(layers){return arrangeable(layers)&&layers.every(function(layer){return layer.type!=='logo'&&layer.type!=='mask'&&!parentGroup(layer.id);});}
  function updateToolbar(){var layers=chosen(),canArrange=arrangeable(layers);document.querySelectorAll('[data-align]').forEach(function(button){button.disabled=!canArrange;});document.querySelectorAll('[data-distribute]').forEach(function(button){button.disabled=!(canArrange&&layers.length>=3);});var group=$('groupSelectionBtn'),ungroup=$('ungroupSelectionBtn');if(group)group.disabled=!groupable(layers);if(ungroup)ungroup.disabled=!(layers.length===1&&layers[0].type==='group'&&!layers[0].locked);var summary=$('multiSelectionSummary');if(!summary)return;if(layers.length>1)summary.textContent=layers.length+' layers selected · drag any selected layer to move the selection together.';else if(layers.length===1&&layers[0].type==='group')summary.textContent='Group selected · arrow keys move all members; Ungroup preserves the child layers.';else summary.textContent='Select two or more unlocked layers with Shift/Cmd/Ctrl-click.';}
  function el(name,attrs){var node=document.createElementNS(NS,name);Object.keys(attrs||{}).forEach(function(key){node.setAttribute(key,String(attrs[key]));});return node;}
  function draw(){var d=doc(),svg=$('artboard');document.querySelectorAll('.layer-row.multi-selected').forEach(function(row){row.classList.remove('multi-selected');});selectedIds=selectedIds.filter(function(id){return Boolean(layerById(id));});selectedIds.forEach(function(id){var rows=Array.from(document.querySelectorAll('[data-select-layer]'));var row=rows.find(function(candidate){return candidate.dataset.selectLayer===id;});if(row)row.classList.add('multi-selected');});if(!svg){updateToolbar();return;}var old=svg.querySelector('#studioMultiSelectionControls');if(old)old.remove();var layers=chosen().filter(function(layer){return layer.visible;});if(layers.length>1){var size=Math.max(2,d.artboard.width/540);var g=el('g',{id:'studioMultiSelectionControls','pointer-events':'none'});layers.forEach(function(layer){var cx=layer.x+layer.width/2,cy=layer.y+layer.height/2;g.appendChild(el('rect',{x:layer.x,y:layer.y,width:layer.width,height:layer.height,fill:'none',stroke:'#52c7ff','stroke-width':size,'stroke-dasharray':'7 5',transform:'rotate('+layer.rotation+' '+cx+' '+cy+')'}));});var frame=bounds(layers);g.appendChild(el('rect',{x:frame.x,y:frame.y,width:frame.width,height:frame.height,fill:'none',stroke:'#52c7ff','stroke-width':Math.max(2,size*1.5),'stroke-dasharray':'12 7'}));if(drag)g.setAttribute('transform','translate('+drag.dx+' '+drag.dy+')');svg.appendChild(g);}updateToolbar();}
  function snapBounds(frame,x,y,d){var tolerance=Math.max(4,d.artboard.width*.006);var safeX=d.artboard.width*.05,safeY=d.artboard.height*.05;var right=d.artboard.width*.95-frame.width,bottom=d.artboard.height*.95-frame.height;var centerX=d.artboard.width/2-frame.width/2,centerY=d.artboard.height/2-frame.height/2;[safeX,right,centerX].some(function(target){if(Math.abs(x-target)<=tolerance){x=target;return true;}return false;});[safeY,bottom,centerY].some(function(target){if(Math.abs(y-target)<=tolerance){y=target;return true;}return false;});return {x:Math.max(0,Math.min(d.artboard.width-frame.width,x)),y:Math.max(0,Math.min(d.artboard.height-frame.height,y))};}
  async function commit(operation,message,nextIds){var p=project();if(!p)return;var preserve=selectedIds.slice();try{var next=await api('/api/studio/operation',{method:'POST',body:JSON.stringify({designId:p.document.id,operation:operation})});window.__creativeStudioLoadProject(next);var desired=typeof nextIds==='function'?nextIds(next):(nextIds||preserve);selectedIds=desired.filter(function(id){return next.document.layers.some(function(layer){return layer.id===id;});});if(!selectedIds.length){var first=primary();if(first)selectedIds=[first.id];}if(selectedIds.length)selectPrimary(selectedIds[selectedIds.length-1]);schedule();status(message,'ok');}catch(error){status(error.message,'error');schedule();}}
  function modifier(event){return event.shiftKey||event.metaKey||event.ctrlKey;}
  function layerHit(event){var target=event.target;if(!target||!target.closest)return null;if(target.closest('#studioTransformControls')||target.closest('#studioMultiSelectionControls'))return null;if(target.closest('[data-eye]')||target.closest('[data-lock]'))return null;var row=target.closest('[data-select-layer]');if(row)return {id:row.dataset.selectLayer,canvas:false};var visual=target.closest('[data-layer-id]');if(visual&&visual.id!=='studioTransformControls')return {id:visual.getAttribute('data-layer-id'),canvas:Boolean(target.closest('#artboard'))};return null;}
  function beginDrag(event){var layers=chosen(),d=doc();if(!d||!arrangeable(layers))return false;var point=svgPoint(event),frame=bounds(layers);drag={start:point,frame:frame,dx:0,dy:0};document.body.style.cursor='move';event.preventDefault();event.stopPropagation();schedule();return true;}
  function pointerDown(event){var hit=layerHit(event);if(!hit||!hit.id)return;if(modifier(event)){event.preventDefault();if(selectedIds.includes(hit.id)){if(selectedIds.length>1)selectedIds=selectedIds.filter(function(id){return id!==hit.id;});}else{selectedIds.push(hit.id);}setTimeout(function(){if(selectedIds.length)selectPrimary(selectedIds[selectedIds.length-1]);schedule();},0);return;}if(hit.canvas&&selectedIds.length>1&&selectedIds.includes(hit.id)){beginDrag(event);return;}selectedIds=[hit.id];setTimeout(schedule,0);}
  function pointerMove(event){if(!drag)return;var d=doc();if(!d)return;var point=svgPoint(event);var x=drag.frame.x+(point.x-drag.start.x),y=drag.frame.y+(point.y-drag.start.y);var snapped=snapBounds(drag.frame,x,y,d);drag.dx=Math.round(snapped.x-drag.frame.x);drag.dy=Math.round(snapped.y-drag.frame.y);var controls=$('artboard').querySelector('#studioMultiSelectionControls');if(controls)controls.setAttribute('transform','translate('+drag.dx+' '+drag.dy+')');}
  function pointerUp(){if(!drag)return;var current=drag;drag=null;document.body.style.cursor='';if(current.dx||current.dy){commit({type:'MOVE_LAYERS',layerIds:selectedIds.slice(),deltaX:current.dx,deltaY:current.dy},'Selected layers moved together.');}else schedule();}
  function align(value){var layers=chosen();if(!arrangeable(layers))return;commit({type:'ALIGN_LAYERS',layerIds:selectedIds.slice(),alignment:value},'Selected layers aligned '+value+'.');}
  function distribute(axis){var layers=chosen();if(!arrangeable(layers)||layers.length<3)return;commit({type:'DISTRIBUTE_LAYERS',layerIds:selectedIds.slice(),axis:axis},'Selected layers distributed '+axis+'ly.');}
  function group(){var layers=chosen();if(!groupable(layers))return;var id='group-'+Date.now();commit({type:'GROUP_LAYERS',layerIds:selectedIds.slice(),groupLayerId:id,name:'Group'},'Selected layers grouped.',[id]);}
  function ungroup(){var layers=chosen();if(layers.length!==1||layers[0].type!=='group')return;var children=layers[0].childLayerIds.slice();commit({type:'UNGROUP_LAYERS',layerId:layers[0].id},'Group removed; child layers preserved.',children);}
  function editableTarget(target){return target&&(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable);}
  function keyboard(event){if(editableTarget(event.target)||event.defaultPrevented)return;var layers=chosen(),d=doc();if(!d)return;if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='g'){event.preventDefault();if(event.shiftKey)ungroup();else group();return;}if(selectedIds.length<2||!arrangeable(layers))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();var amount=event.shiftKey?10:1;var frame=bounds(layers);var x=frame.x+(event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0);var y=frame.y+(event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0);var snapped=snapBounds(frame,x,y,d);commit({type:'MOVE_LAYERS',layerIds:selectedIds.slice(),deltaX:Math.round(snapped.x-frame.x),deltaY:Math.round(snapped.y-frame.y)},'Selected layers nudged '+(event.shiftKey?'10':'1')+' px.');}}
  function bind(){document.addEventListener('pointerdown',pointerDown,true);document.addEventListener('pointermove',pointerMove,true);document.addEventListener('pointerup',pointerUp,true);document.addEventListener('keydown',keyboard,true);document.querySelectorAll('[data-align]').forEach(function(button){button.addEventListener('click',function(){align(button.dataset.align);});});document.querySelectorAll('[data-distribute]').forEach(function(button){button.addEventListener('click',function(){distribute(button.dataset.distribute);});});var groupButton=$('groupSelectionBtn'),ungroupButton=$('ungroupSelectionBtn');if(groupButton)groupButton.addEventListener('click',group);if(ungroupButton)ungroupButton.addEventListener('click',ungroup);var meta=$('designMeta');if(meta&&window.MutationObserver)new MutationObserver(function(){syncSingle();schedule();}).observe(meta,{childList:true,subtree:true});syncSingle();schedule();}
  bind();
})();
</script>`;
  html = injectBefore(html, "</body>", script);
  return html;
}
