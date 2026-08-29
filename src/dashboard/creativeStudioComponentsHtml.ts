import { creativeStudioLayerManagerHtml } from "./creativeStudioLayerManagerHtml.js";

function injectBefore(html: string, marker: string, content: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_COMPONENTS_MARKER_MISSING: ${marker}`);
  return html.replace(marker, `${content}${marker}`);
}

export function creativeStudioComponentsHtml(): string {
  let html = creativeStudioLayerManagerHtml();

  const style = `<style>
    #componentLibrary select{width:100%;border:1px solid var(--line);background:#111315;color:var(--text);border-radius:8px;padding:8px}
    #componentLibrary .component-meta{font-size:10px;color:var(--muted);line-height:1.45;margin:7px 0}
    #componentLibrary button:disabled{opacity:.38;cursor:not-allowed}
  </style>`;
  html = injectBefore(html, "</head>", style);

  const script = `<script>
(function(){
  'use strict';
  var components=[],lastDesignId=null,refreshing=false;
  function $(id){return document.getElementById(id);}
  function project(){return window.__creativeStudioCurrentProject&&window.__creativeStudioCurrentProject();}
  function primary(){return window.__creativeStudioSelectedLayer&&window.__creativeStudioSelectedLayer();}
  function selection(){var ids=window.__creativeStudioMultiSelectionIds?window.__creativeStudioMultiSelectionIds():[];if(ids.length)return ids;var layer=primary();return layer?[layer.id]:[];}
  function setSelection(ids){return window.__creativeStudioSetMultiSelection?window.__creativeStudioSetMultiSelection(ids):ids;}
  function status(message,type){if(window.__creativeStudioSetStatus)window.__creativeStudioSetStatus(message,type);}
  async function api(path,options){var response=await fetch(path,Object.assign({headers:{'content-type':'application/json'}},options||{}));var data=await response.json();if(!response.ok)throw new Error(data.error||('HTTP '+response.status));return data;}
  function doc(){var p=project();return p&&p.document;}
  function byId(id){var d=doc();return d&&d.layers.find(function(layer){return layer.id===id;});}
  function selectedGroup(){var layers=selection().map(byId).filter(Boolean);return layers.length===1&&layers[0].type==='group'?layers[0]:null;}
  function slug(value){var out=String(value||'block').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);return out||'block';}
  function selectedComponent(){var select=$('componentSelect');return select?components.find(function(component){return component.id===select.value;}):null;}
  function render(){var select=$('componentSelect'),meta=$('componentMeta'),save=$('saveComponentBtn'),insert=$('insertComponentBtn');if(!select)return;var current=select.value;select.innerHTML='<option value="">Choose a reusable block…</option>'+components.map(function(component){return '<option value="'+component.id+'">'+component.name+'</option>';}).join('');if(components.some(function(component){return component.id===current;}))select.value=current;var component=selectedComponent();meta.textContent=component?component.templateCount+' native layers · '+(component.requiredTruthKeys.length?('requires confirmed '+component.requiredTruthKeys.join(', ')):'no detected factual dependencies'):'Blocks store structure/style only. Source campaign text and asset-backed imagery are never copied into the library.';save.disabled=!selectedGroup();insert.disabled=!component;}
  async function refresh(force){var d=doc();if(!d){components=[];lastDesignId=null;render();return;}if(refreshing)return;if(!force&&lastDesignId===d.id&&components.length)return;refreshing=true;try{var result=await api('/api/studio/components?designId='+encodeURIComponent(d.id));components=result.components||[];lastDesignId=d.id;render();}catch(error){status(error.message,'error');}finally{refreshing=false;}}
  async function saveSelected(){var d=doc(),group=selectedGroup();if(!d||!group)return;var name=window.prompt('Reusable block name',group.name);if(name==null||!name.trim())return;var componentId=slug(name)+'-'+Date.now();try{status('Saving structure/style block…');await api('/api/studio/components/create',{method:'POST',body:JSON.stringify({designId:d.id,groupLayerId:group.id,componentId:componentId,name:name.trim()})});await refresh(true);$('componentSelect').value=componentId;render();status('Reusable block saved without source campaign copy or asset-backed imagery.','ok');}catch(error){status(error.message,'error');}}
  async function insertSelected(){var d=doc(),component=selectedComponent();if(!d||!component)return;var instanceId='component-'+Date.now();try{status('Validating destination truth and inserting reusable block…');var result=await api('/api/studio/components/instantiate',{method:'POST',body:JSON.stringify({designId:d.id,componentId:component.id,instanceId:instanceId})});window.__creativeStudioLoadProject(result.project);setSelection([result.instanceGroupId]);render();status('Reusable block inserted with destination text rebinding.','ok');}catch(error){status(error.message,'error');}}
  function inject(){var panel=$('arrangePanel');if(!panel||$('componentLibrary'))return;var block=document.createElement('div');block.id='componentLibrary';block.className='section';block.style.marginTop='14px';block.innerHTML='<h3>Reusable Blocks</h3><select id="componentSelect"><option value="">Choose a reusable block…</option></select><div id="componentMeta" class="component-meta">Blocks store structure/style only. Source campaign text and asset-backed imagery are never copied into the library.</div><div class="toolbar-row"><button id="saveComponentBtn" class="secondary" disabled>Save Selected Group</button><button id="insertComponentBtn" class="secondary" disabled>Insert Block</button></div><button id="refreshComponentsBtn" class="secondary" style="width:100%">Refresh Library</button><div class="note" style="margin-top:7px">Components are client+brand scoped. Insertion reuses destination native text roles and fails closed if required confirmed truth is absent.</div>';panel.appendChild(block);$('componentSelect').addEventListener('change',render);$('saveComponentBtn').addEventListener('click',saveSelected);$('insertComponentBtn').addEventListener('click',insertSelected);$('refreshComponentsBtn').addEventListener('click',function(){refresh(true);});}
  function bind(){inject();document.addEventListener('click',function(){setTimeout(render,0);},true);var meta=$('designMeta');if(meta&&window.MutationObserver)new MutationObserver(function(){var d=doc();if(d&&d.id!==lastDesignId)refresh(true);else render();}).observe(meta,{childList:true,subtree:true});setTimeout(function(){refresh(true);render();},0);}
  bind();
})();
</script>`;
  html = injectBefore(html, "</body>", script);
  return html;
}
