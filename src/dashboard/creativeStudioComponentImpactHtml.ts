import { creativeStudioComponentAuthoringHtml } from "./creativeStudioComponentAuthoringHtml.js";

function injectBefore(html: string, marker: string, content: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_COMPONENT_IMPACT_MARKER_MISSING: ${marker}`);
  return html.replace(marker, `${content}${marker}`);
}

export function creativeStudioComponentImpactHtml(): string {
  let html = creativeStudioComponentAuthoringHtml();

  const style = `<style>
    #componentImpact .impact-summary{font-size:10px;color:var(--muted);line-height:1.5;margin:7px 0}
    #componentImpact .impact-list{max-height:210px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:#0d1012}
    #componentImpact .impact-row{padding:7px 8px;border-bottom:1px solid var(--line);font-size:10px;line-height:1.45}
    #componentImpact .impact-row:last-child{border-bottom:0}
    #componentImpact .impact-frozen{color:#efcf72}
    #componentImpact .impact-blocked{color:#ff9d9d}
    #componentImpact .impact-ok{color:#9ed7aa}
  </style>`;
  html = injectBefore(html, "</head>", style);

  const script = `<script>
(function(){
  'use strict';
  var lastReport=null,lastFamilyId='',lastTargetId='',families=[];
  function $(id){return document.getElementById(id);}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function project(){return window.__creativeStudioCurrentProject&&window.__creativeStudioCurrentProject();}
  function doc(){var p=project();return p&&p.document;}
  function status(message,type){if(window.__creativeStudioSetStatus)window.__creativeStudioSetStatus(message,type);}
  async function api(path,options){var response=await fetch(path,Object.assign({headers:{'content-type':'application/json'}},options||{}));var data=await response.json();if(!response.ok)throw new Error(data.error||('HTTP '+response.status));return data;}
  function familyId(){var el=$('componentFamilySelect');return el&&el.value?el.value:'';}
  function selectedTargetId(){var el=$('componentVersionSelect');return el&&el.value?el.value:'';}
  function familyById(id){return families.find(function(family){return family.familyId===id;});}
  function invalidate(message){lastReport=null;lastFamilyId='';lastTargetId='';var summary=$('componentImpactSummary'),list=$('componentImpactList');if(summary)summary.textContent=message||'Run analysis to inspect every attached instance of the selected family.';if(list)list.innerHTML='';}
  async function loadFamilies(){var d=doc();if(!d)return [];var result=await api('/api/studio/components?designId='+encodeURIComponent(d.id));families=result.families||[];return families;}
  function render(report){lastReport=report;lastFamilyId=report.familyId;lastTargetId=report.targetComponentId;var t=report.totals,summary=$('componentImpactSummary'),list=$('componentImpactList');summary.innerHTML='<strong>'+esc(report.familyId)+'</strong> → target v'+report.targetVersion+' · '+t.designs+' designs · '+t.instances+' instances · '+t.upgradeable+' upgradeable · '+t.blocked+' blocked · '+t.frozenApproved+' approved/frozen';var rows=[];report.designs.forEach(function(design){design.instances.forEach(function(item){var cls=item.governance==='FROZEN_APPROVED'?'impact-frozen':item.upgradeReadiness.indexOf('BLOCKED_')===0?'impact-blocked':item.upgradeReadiness==='UPGRADEABLE'?'impact-ok':'';var details=[];if(item.missingTruthKeys.length)details.push('truth: '+item.missingTruthKeys.join(', '));if(item.missingTextRoles.length)details.push('roles: '+item.missingTextRoles.join(', '));rows.push('<div class="impact-row '+cls+'"><strong>'+esc(item.designId)+'</strong> v'+item.designVersion+' · '+esc(item.instanceId)+' · component v'+item.currentVersion+' → v'+item.targetVersion+'<br>'+esc(item.governance)+' · '+esc(item.upgradeReadiness)+(details.length?'<br>'+esc(details.join(' · ')):'')+'<br>'+esc(item.reason)+'</div>');});});list.innerHTML=rows.length?rows.join(''):'<div class="impact-row impact-ok">No current DesignDocument contains an attached instance from this family.</div>';}
  async function analyze(targetOverride){var d=doc(),fid=familyId();if(!d||!fid){status('Select a component family before impact analysis.','error');return null;}if(!families.length)await loadFamilies();var family=familyById(fid);if(!family){await loadFamilies();family=familyById(fid);}if(!family)throw new Error('Selected component family is unavailable.');var targetId=targetOverride||selectedTargetId()||family.latestComponentId;status('Analyzing component dependencies across Studio designs…');var result=await api('/api/studio/components/impact?designId='+encodeURIComponent(d.id)+'&familyId='+encodeURIComponent(fid)+'&targetComponentId='+encodeURIComponent(targetId));render(result.report);status('Component dependency impact analysis complete.','ok');return result.report;}
  async function guardedLifecycle(nextStatus,event){if(event){event.preventDefault();event.stopImmediatePropagation();}var d=doc(),fid=familyId();if(!d||!fid)return;try{await loadFamilies();var family=familyById(fid);if(!family)throw new Error('Selected component family is unavailable.');var report=await analyze(family.latestComponentId);var t=report.totals;var warning='This family is used by '+t.instances+' attached instance(s) across '+t.designs+' design(s). '+t.frozenApproved+' are on approved current design versions and remain frozen. Continue to '+nextStatus.toLowerCase()+' the family?';if(!window.confirm(warning))return;await api('/api/studio/components/status',{method:'POST',body:JSON.stringify({designId:d.id,familyId:fid,status:nextStatus,impactToken:report.impactToken})});var refresh=$('refreshComponentsBtn');if(refresh)refresh.click();invalidate('Family status changed after verified impact analysis. Run analysis again for the new lifecycle state.');status('Component family changed to '+nextStatus+' after dependency impact verification.','ok');}catch(error){status(error.message,'error');}}
  function inject(){var library=$('componentLibrary');if(!library||$('componentImpact'))return;var block=document.createElement('div');block.id='componentImpact';block.style.marginTop='14px';block.innerHTML='<h3>Dependency Impact</h3><div class="note">Read-only analysis scans every current Studio design using this family, checks exact-version approval/freeze state, destination truth and text-role compatibility, and simulates governed upgrades in memory.</div><button id="analyzeComponentImpactBtn" class="secondary" style="width:100%;margin-top:8px">Analyze Selected Version Impact</button><div id="componentImpactSummary" class="impact-summary">Run analysis to inspect every attached instance of the selected family.</div><div id="componentImpactList" class="impact-list"></div>';library.appendChild(block);$('analyzeComponentImpactBtn').addEventListener('click',function(){analyze().catch(function(error){status(error.message,'error');});});var family=$('componentFamilySelect'),version=$('componentVersionSelect');if(family)family.addEventListener('change',function(){invalidate('Family changed. Run impact analysis again.');loadFamilies().catch(function(){});});if(version)version.addEventListener('change',function(){invalidate('Target version changed. Run impact analysis again.');});var dep=$('deprecateComponentBtn'),arc=$('archiveComponentBtn');if(dep)dep.addEventListener('click',function(event){guardedLifecycle('DEPRECATED',event);},true);if(arc)arc.addEventListener('click',function(event){guardedLifecycle('ARCHIVED',event);},true);}
  function bind(){inject();loadFamilies().catch(function(){});var meta=$('designMeta');if(meta&&window.MutationObserver)new MutationObserver(function(){var d=doc();if(!d)return;if(lastReport&&d.version!==lastReport.designs.find(function(x){return x.designId===d.id;})?.designVersion)invalidate('Design state changed. Run impact analysis again.');}).observe(meta,{childList:true,subtree:true});}
  bind();
})();
</script>`;
  html = injectBefore(html, "</body>", script);
  return html;
}
