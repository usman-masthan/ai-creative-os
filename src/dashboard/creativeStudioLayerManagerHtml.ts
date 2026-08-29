import { creativeStudioCompositionHtml } from "./creativeStudioCompositionHtml.js";

function injectBefore(html: string, marker: string, content: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_LAYER_MANAGER_MARKER_MISSING: ${marker}`);
  return html.replace(marker, `${content}${marker}`);
}

export function creativeStudioLayerManagerHtml(): string {
  let html = creativeStudioCompositionHtml();

  const style = `<style>
    #layersList .layer-row.hierarchy-row{grid-template-columns:24px 24px 1fr 26px}
    #layersList .layer-row.group-row{background:#171d21;border-color:#303a40}
    #layersList .layer-row.group-child{margin-left:18px;width:calc(100% - 18px)}
    #layersList .hierarchy-toggle{font-size:11px;color:#9fcde5}
    #layersList [data-layer-label]{cursor:text}
    #layersList [data-layer-label]:hover{text-decoration:underline dotted}
    #layerOrderControls button:disabled{opacity:.38;cursor:not-allowed}
  </style>`;
  html = injectBefore(html, "</head>", style);

  const script = `<script>
(function(){
  'use strict';
  var collapsed=new Set();
  function $(id){return document.getElementById(id);}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function project(){return window.__creativeStudioCurrentProject&&window.__creativeStudioCurrentProject();}
  function primary(){return window.__creativeStudioSelectedLayer&&window.__creativeStudioSelectedLayer();}
  function selection(){var ids=window.__creativeStudioMultiSelectionIds?window.__creativeStudioMultiSelectionIds():[];if(ids.length)return ids;var layer=primary();return layer?[layer.id]:[];}
  function setSelection(ids){if(window.__creativeStudioSetMultiSelection)return window.__creativeStudioSetMultiSelection(ids);return ids;}
  function status(message,type){if(window.__creativeStudioSetStatus)window.__creativeStudioSetStatus(message,type);}
  async function api(path,options){var response=await fetch(path,Object.assign({headers:{'content-type':'application/json'}},options||{}));var data=await response.json();if(!response.ok)throw new Error(data.error||('HTTP '+response.status));return data;}
  function doc(){var p=project();return p&&p.document;}
  function byId(id){var d=doc();return d&&d.layers.find(function(layer){return layer.id===id;});}
  function parentMap(d){var map={};d.layers.forEach(function(layer){if(layer.type==='group')layer.childLayerIds.forEach(function(id){map[id]=layer.id;});});return map;}
  function orderable(layer){return Boolean(layer)&&!layer.locked&&layer.type!=='background'&&layer.type!=='logo'&&layer.type!=='mask';}
  function row(layer,depth){var selected=selection().includes(layer.id),active=primary()&&primary().id===layer.id;var isGroup=layer.type==='group';var toggle=isGroup?'<button class="iconbtn hierarchy-toggle" data-group-toggle="'+esc(layer.id)+'">'+(collapsed.has(layer.id)?'▸':'▾')+'</button>':'<span></span>';return '<div class="layer-row hierarchy-row '+(isGroup?'group-row ':'')+(depth?'group-child ':'')+(active?'selected ':'')+(selected?'multi-selected ':'')+'" data-select-layer="'+esc(layer.id)+'">'+toggle+'<button class="iconbtn" data-eye="'+esc(layer.id)+'">'+(layer.visible?'●':'○')+'</button><div class="layer-name"><strong data-layer-label="'+esc(layer.id)+'">'+esc(layer.name)+'</strong><small>'+esc(layer.type)+' · z '+layer.zIndex+(isGroup?' · '+layer.childLayerIds.length+' children':'')+(layer.aiEditable?' · AI':'')+'</small></div><button class="iconbtn" data-lock="'+esc(layer.id)+'">'+(layer.locked?'🔒':'◇')+'</button></div>';}
  function renderHierarchy(){var d=doc(),list=$('layersList');if(!d||!list)return;var parents=parentMap(d),top=d.layers.filter(function(layer){return !parents[layer.id];}).sort(function(a,b){return b.zIndex-a.zIndex;});var html=[];top.forEach(function(layer){html.push(row(layer,0));if(layer.type==='group'&&!collapsed.has(layer.id)){layer.childLayerIds.map(function(id){return d.layers.find(function(candidate){return candidate.id===id;});}).filter(Boolean).sort(function(a,b){return b.zIndex-a.zIndex;}).forEach(function(child){html.push(row(child,1));});}});list.innerHTML=html.join('')||'<p class="note">No design loaded.</p>';updateControls();}
  function selectedLayers(){return selection().map(byId).filter(Boolean);}
  function updateControls(){var layers=selectedLayers(),canOrder=layers.length>0&&layers.every(orderable);document.querySelectorAll('[data-layer-order]').forEach(function(button){button.disabled=!canOrder;});var duplicate=$('duplicateGroupBtn');if(duplicate)duplicate.disabled=!(layers.length===1&&layers[0].type==='group'&&!layers[0].locked);}
  async function commit(operation,message,nextSelection){var p=project();if(!p)return;try{var next=await api('/api/studio/multi-object',{method:'POST',body:JSON.stringify({designId:p.document.id,operation:operation})});window.__creativeStudioLoadProject(next);if(nextSelection)setSelection(nextSelection);renderHierarchy();status(message,'ok');}catch(error){status(error.message,'error');renderHierarchy();}}
  function reorder(placement){var ids=selection();if(!ids.length)return;commit({type:'REORDER_LAYERS',layerIds:ids,placement:placement},'Layer order updated: '+placement.toLowerCase()+'.',ids);}
  function duplicateGroup(){var layers=selectedLayers();if(layers.length!==1||layers[0].type!=='group'||layers[0].locked)return;var group=layers[0],stamp=Date.now(),groupId=group.id+'-copy-'+stamp,childIds=group.childLayerIds.map(function(id,index){return id+'-copy-'+stamp+'-'+index;});commit({type:'DUPLICATE_GROUP',groupLayerId:group.id,newGroupLayerId:groupId,newChildLayerIds:childIds,offsetX:24,offsetY:24},'Group duplicated with native editable children.',[groupId]);}
  function rename(layerId){var layer=byId(layerId);if(!layer)return;var next=window.prompt('Rename layer',layer.name);if(next==null||next.trim()===layer.name)return;commit({type:'RENAME_LAYER',layerId:layer.id,name:next.trim()},'Layer renamed.',selection());}
  function layerClick(event){var toggle=event.target.closest&&event.target.closest('[data-group-toggle]');if(!toggle)return;event.preventDefault();event.stopImmediatePropagation();var id=toggle.dataset.groupToggle;if(collapsed.has(id))collapsed.delete(id);else collapsed.add(id);renderHierarchy();}
  function layerDoubleClick(event){var label=event.target.closest&&event.target.closest('[data-layer-label]');if(!label)return;event.preventDefault();event.stopPropagation();rename(label.dataset.layerLabel);}
  function keydown(event){if(event.target&&(/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.isContentEditable))return;if(!(event.metaKey||event.ctrlKey)||event.altKey)return;if(event.key===']'){event.preventDefault();reorder(event.shiftKey?'FRONT':'FORWARD');}else if(event.key==='['){event.preventDefault();reorder(event.shiftKey?'BACK':'BACKWARD');}}
  function injectControls(){var panel=$('arrangePanel');if(!panel||$('layerOrderControls'))return;var block=document.createElement('div');block.id='layerOrderControls';block.innerHTML='<h3 style="margin-top:13px">Layer Order</h3><div class="toolbar-row"><button class="secondary" data-layer-order="FRONT" disabled>Front</button><button class="secondary" data-layer-order="FORWARD" disabled>Forward</button></div><div class="toolbar-row"><button class="secondary" data-layer-order="BACKWARD" disabled>Backward</button><button class="secondary" data-layer-order="BACK" disabled>Back</button></div><button id="duplicateGroupBtn" class="secondary" style="width:100%;margin-top:5px" disabled>Duplicate Whole Group</button><div class="note" style="margin-top:7px">Double-click a layer name to rename. Cmd/Ctrl+] and Cmd/Ctrl+[ move the selection one level; add Shift for front/back.</div>';panel.appendChild(block);block.querySelectorAll('[data-layer-order]').forEach(function(button){button.addEventListener('click',function(){reorder(button.dataset.layerOrder);});});$('duplicateGroupBtn').addEventListener('click',duplicateGroup);}
  function bind(){injectControls();var list=$('layersList');if(list){list.addEventListener('click',layerClick,true);list.addEventListener('dblclick',layerDoubleClick,true);}document.addEventListener('click',function(){setTimeout(function(){renderHierarchy();updateControls();},0);},true);document.addEventListener('keydown',keydown,true);var meta=$('designMeta');if(meta&&window.MutationObserver)new MutationObserver(function(){renderHierarchy();}).observe(meta,{childList:true,subtree:true});setTimeout(renderHierarchy,0);}
  bind();
})();
</script>`;
  html = injectBefore(html, "</body>", script);
  return html;
}
