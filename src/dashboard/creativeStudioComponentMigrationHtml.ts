import { creativeStudioComponentImpactHtml } from "./creativeStudioComponentImpactHtml.js";

function injectBefore(html: string, marker: string, content: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_COMPONENT_MIGRATION_MARKER_MISSING: ${marker}`);
  return html.replace(marker, `${content}${marker}`);
}

export function creativeStudioComponentMigrationHtml(): string {
  let html = creativeStudioComponentImpactHtml();

  const style = `<style>
    #componentMigration .migration-summary{font-size:10px;color:var(--muted);line-height:1.5;margin:7px 0}
    #componentMigration .migration-list{max-height:235px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:#0d1012;margin-top:7px}
    #componentMigration .migration-row{display:flex;gap:7px;align-items:flex-start;padding:7px 8px;border-bottom:1px solid var(--line);font-size:10px;line-height:1.45}
    #componentMigration .migration-row:last-child{border-bottom:0}
    #componentMigration .migration-row input{margin-top:2px}
    #componentMigration .migration-excluded{color:#ffb0b0}
    #componentMigration .migration-eligible{color:#9ed7aa}
    #componentMigration button:disabled{opacity:.38;cursor:not-allowed}
  </style>`;
  html = injectBefore(html, "</head>", style);

  const script = `<script>
(function(){
  'use strict';
  var activePlan=null;
  function $(id){return document.getElementById(id);}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function project(){return window.__creativeStudioCurrentProject&&window.__creativeStudioCurrentProject();}
  function doc(){var p=project();return p&&p.document;}
  function status(message,type){if(window.__creativeStudioSetStatus)window.__creativeStudioSetStatus(message,type);}
  async function api(path,options){var response=await fetch(path,Object.assign({headers:{'content-type':'application/json'}},options||{}));var data=await response.json();if(!response.ok)throw new Error(data.error||('HTTP '+response.status));return data;}
  function familyId(){var el=$('componentFamilySelect');return el&&el.value?el.value:'';}
  function targetId(){var el=$('componentVersionSelect');return el&&el.value?el.value:'';}
  function invalidate(message){activePlan=null;var summary=$('componentMigrationSummary'),list=$('componentMigrationList'),execute=$('executeComponentMigrationBtn');if(summary)summary.textContent=message||'Create a dry-run plan to review eligible design migrations and explicit exclusions.';if(list)list.innerHTML='';if(execute)execute.disabled=true;}
  function selectedItemIds(){return Array.from(document.querySelectorAll('#componentMigrationList input[data-migration-item]:checked')).map(function(input){return input.getAttribute('data-migration-item');}).filter(Boolean);}
  function syncExecute(){var button=$('executeComponentMigrationBtn');if(button)button.disabled=!(activePlan&&selectedItemIds().length);}
  function render(plan){activePlan=plan;var t=plan.totals,summary=$('componentMigrationSummary'),list=$('componentMigrationList');summary.innerHTML='<strong>'+esc(plan.planId)+'</strong><br>target component v'+plan.targetVersion+' · '+t.eligibleDesigns+' eligible design(s) / '+t.eligibleInstances+' instance(s) · '+t.excludedInstances+' excluded · '+t.frozenApproved+' approved/frozen · '+t.blocked+' blocked';var rows=[];plan.eligibleDesigns.forEach(function(item){rows.push('<label class="migration-row migration-eligible"><input type="checkbox" data-migration-item="'+esc(item.itemId)+'" checked><span><strong>'+esc(item.designId)+'</strong> v'+item.sourceDesignVersion+' → v'+item.targetDesignVersion+'<br>'+item.instances.length+' eligible instance(s): '+esc(item.instances.map(function(instance){return instance.instanceId+' (v'+instance.currentVersion+'→v'+instance.targetVersion+')';}).join(', '))+'</span></label>');});plan.exclusions.forEach(function(item){rows.push('<div class="migration-row migration-excluded"><span>×</span><span><strong>'+esc(item.designId)+'</strong> v'+item.designVersion+' · '+esc(item.instanceId)+'<br>'+esc(item.governance)+' · '+esc(item.upgradeReadiness)+'<br>'+esc(item.reason)+'</span></div>');});list.innerHTML=rows.length?rows.join(''):'<div class="migration-row">No attached family instances require migration.</div>';Array.from(list.querySelectorAll('input[data-migration-item]')).forEach(function(input){input.addEventListener('change',syncExecute);});syncExecute();}
  async function createPlan(){var d=doc(),fid=familyId(),target=targetId();if(!d||!fid||!target){status('Select a component family and target version before creating a migration plan.','error');return;}try{status('Creating immutable dry-run component migration plan…');var result=await api('/api/studio/components/migration-plan',{method:'POST',body:JSON.stringify({designId:d.id,familyId:fid,targetComponentId:target})});render(result.plan);status('Dry-run migration plan created. Review eligible designs and exclusions before execution.','ok');}catch(error){invalidate();status(error.message,'error');}}
  async function execute(){var d=doc();if(!d||!activePlan)return;var ids=selectedItemIds();if(!ids.length){status('Select at least one eligible design migration.','error');return;}var message='Execute '+ids.length+' selected design migration(s)? Each selected design receives one new DesignDocument revision and deterministic QA. Approved/frozen and blocked designs remain excluded.';if(!window.confirm(message))return;try{status('Revalidating migration preconditions and executing selected designs…');var result=await api('/api/studio/components/migration-execute',{method:'POST',body:JSON.stringify({designId:d.id,planId:activePlan.planId,expectedPlanToken:activePlan.planToken,selectedItemIds:ids})});var executed=result.execution.executedDesigns||[];var current=executed.find(function(item){return item.designId===d.id;});if(current){var refreshed=await api('/api/studio/project?designId='+encodeURIComponent(d.id));if(window.__creativeStudioLoadProject)window.__creativeStudioLoadProject(refreshed);}invalidate('Migration execution completed. Create a new dry-run plan before any additional migration because dependency state has changed.');var refresh=$('refreshComponentsBtn');if(refresh)refresh.click();status('Migrated '+executed.length+' design(s). Every migrated design received one revision and deterministic QA.','ok');}catch(error){status(error.message,'error');}}
  function inject(){var impact=$('componentImpact');if(!impact||$('componentMigration'))return;var block=document.createElement('div');block.id='componentMigration';block.style.marginTop='14px';block.innerHTML='<h3>Migration Planner</h3><div class="note">Creates an immutable dry-run plan from current impact state. Only editable + upgradeable instances become eligible. Approved/frozen and blocked instances are explicit exclusions.</div><button id="createComponentMigrationBtn" class="secondary" style="width:100%;margin-top:8px">Create Dry-run Migration Plan</button><div id="componentMigrationSummary" class="migration-summary">Create a dry-run plan to review eligible design migrations and explicit exclusions.</div><div id="componentMigrationList" class="migration-list"></div><button id="executeComponentMigrationBtn" class="secondary" style="width:100%;margin-top:7px" disabled>Execute Selected Design Migrations</button><div class="note" style="margin-top:7px">Execution reloads the stored immutable plan, validates each selected design against its plan-time version/provenance/approval state, performs all selected preflights before saving, then persists one revision + QA per design. No model calls.</div>';impact.appendChild(block);$('createComponentMigrationBtn').addEventListener('click',createPlan);$('executeComponentMigrationBtn').addEventListener('click',execute);var family=$('componentFamilySelect'),version=$('componentVersionSelect');if(family)family.addEventListener('change',function(){invalidate('Family changed. Create a new migration plan.');});if(version)version.addEventListener('change',function(){invalidate('Target version changed. Create a new migration plan.');});}
  function bind(){inject();var meta=$('designMeta');if(meta&&window.MutationObserver)new MutationObserver(function(){var d=doc();if(!d||!activePlan)return;var planned=activePlan.eligibleDesigns.find(function(item){return item.designId===d.id;});if(planned&&planned.sourceDesignVersion!==d.version)invalidate('Current design changed after plan creation. Create a fresh migration plan.');}).observe(meta,{childList:true,subtree:true});}
  bind();
})();
</script>`;
  html = injectBefore(html, "</body>", script);
  return html;
}
