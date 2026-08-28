import { creativeStudioFinalHtml } from "./creativeStudioFinalHtml.js";

function replaceRequired(html: string, marker: string, replacement: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_PROFILE_MARKER_MISSING: ${marker}`);
  return html.replace(marker, replacement);
}

export function creativeStudioProfiledHtml(): string {
  let html = creativeStudioFinalHtml();

  const fallbackTruth = {
    providerId: "ATTHAS_UI_TRUTH_V1",
    bootstrap: "/api/ui/bootstrap",
    prepare: "/api/ui/prepare",
    confirm: "/api/ui/confirm",
    upload: "/api/ui/upload",
    produce: "/api/ui/produce",
  } as const;
  const fallbackAttributes = `data-client-id="T001" data-brand-kit-id="ATTHAS_WORKING_V1" data-truth-provider-id="${fallbackTruth.providerId}" data-truth-bootstrap="${fallbackTruth.bootstrap}" data-truth-prepare="${fallbackTruth.prepare}" data-truth-confirm="${fallbackTruth.confirm}" data-truth-upload="${fallbackTruth.upload}" data-truth-produce="${fallbackTruth.produce}"`;

  html = replaceRequired(
    html,
    `<select id="brandId"><option value="ATTHAS_BURGER">ATTHA'S Burger</option><option value="ATTHAS_RESTAURANT">ATTHA'S Restaurant</option></select>`,
    `<select id="brandId"><option value="ATTHAS_BURGER" ${fallbackAttributes}>ATTHA'S Burger</option><option value="ATTHAS_RESTAURANT" ${fallbackAttributes}>ATTHA'S Restaurant</option></select>`,
  );

  html = replaceRequired(
    html,
    `clientId:'T001',brandId:$('brandId').value`,
    `clientId:$('brandId').selectedOptions[0].dataset.clientId,brandId:$('brandId').value`,
  );
  html = replaceRequired(
    html,
    `brandKitId:'ATTHAS_WORKING_V1',createdAt:new Date().toISOString()`,
    `brandKitId:$('brandId').selectedOptions[0].dataset.brandKitId,createdAt:new Date().toISOString()`,
  );

  html = replaceRequired(
    html,
    `function selectedVibes(){`,
    `function truthEndpoint(name){var option=$('brandId').selectedOptions[0];if(!option)throw new Error('Select a brand first.');var key='truth'+name.charAt(0).toUpperCase()+name.slice(1);var path=option.dataset[key];if(!path)throw new Error('Truth provider '+name+' endpoint is unavailable for the selected client.');return path;}
  async function reloadTruthBootstrap(){state.uiBootstrap=await api(truthEndpoint('bootstrap'));populateBranches();}
  function selectedVibes(){`,
  );
  html = replaceRequired(html, `api('/api/ui/prepare'`, `api(truthEndpoint('prepare')`);
  html = replaceRequired(html, `api('/api/ui/confirm'`, `api(truthEndpoint('confirm')`);
  html = replaceRequired(html, `api('/api/ui/upload'`, `api(truthEndpoint('upload')`);
  html = replaceRequired(html, `api('/api/ui/produce'`, `api(truthEndpoint('produce')`);
  html = replaceRequired(html, `api('/api/ui/bootstrap')`, `api(truthEndpoint('bootstrap'))`);
  html = replaceRequired(
    html,
    `$('brandId').onchange=populateBranches;`,
    `$('brandId').onchange=function(){reloadTruthBootstrap().catch(function(error){setStatus(error.message,'error');});};`,
  );

  html = replaceRequired(
    html,
    `state.snapshot=confirmed.snapshot;state.brief.truthSnapshotId='task:'+state.snapshot.sessionId;$('truthModal').classList.add('hidden');showProgress(2);setStatus('Generating governed campaign…');var baseImageAssetId=await uploadBaseImage(intent);`,
    `state.snapshot=confirmed.snapshot;state.brief.truthSnapshotId='task:'+state.snapshot.sessionId;$('truthModal').classList.add('hidden');showProgress(2);setStatus('Coordinating creative strategy…');state.orchestration=await api('/api/studio/orchestrate',{method:'POST',body:JSON.stringify({campaignId:state.prepared.campaignId,brief:state.brief,taskTruthSnapshot:state.snapshot})});if(!state.orchestration||state.orchestration.status!=='READY_FOR_GOVERNED_PRODUCTION')throw new Error('Creative Orchestrator did not authorize governed production.');setStatus('Generating governed campaign…');var baseImageAssetId=await uploadBaseImage(intent);`,
  );
  html = replaceRequired(
    html,
    `var project=await api('/api/studio/open',{method:'POST',body:JSON.stringify({campaignId:state.prepared.campaignId,brief:state.brief})});var orchestrationLink=await api('/api/studio/orchestration/link',{method:'POST',body:JSON.stringify({designId:project.document.id,orchestrationId:state.orchestration.id})});if(!orchestrationLink.linked)throw new Error('Creative Orchestrator provenance could not be linked to the design.');project.orchestration=state.orchestration;loadProject(project);`,
    `var project=await api('/api/studio/open',{method:'POST',body:JSON.stringify({campaignId:state.prepared.campaignId,brief:state.brief})});var orchestrationLink=await api('/api/studio/orchestration/link',{method:'POST',body:JSON.stringify({designId:project.document.id,orchestrationId:state.orchestration.id})});if(!orchestrationLink.linked)throw new Error('Creative Orchestrator provenance could not be linked to the design.');var orchestrationExecution=await api('/api/studio/orchestration/complete',{method:'POST',body:JSON.stringify({designId:project.document.id,orchestrationId:state.orchestration.id})});if(!orchestrationExecution||orchestrationExecution.extraModelCallsAddedByOrchestrator!==0)throw new Error('Creative Orchestrator execution audit could not be completed safely.');project.orchestration=state.orchestration;project.orchestrationExecution=orchestrationExecution;loadProject(project);`,
  );

  const profileScript = `<script>
(function(){
  'use strict';
  async function populateCreativeClientProfiles(){
    try{
      var response=await fetch('/api/studio/bootstrap');
      var data=await response.json();
      if(!response.ok||!Array.isArray(data.clientProfiles)||!data.clientProfiles.length)return;
      var select=document.getElementById('brandId');
      if(!select)return;
      var previous=select.value;
      var manyClients=data.clientProfiles.length>1;
      var options=[];
      data.clientProfiles.forEach(function(profile){
        var truth=profile.truthProvider;
        if(!truth||!truth.endpoints)return;
        (profile.brands||[]).forEach(function(brand){
          var option=document.createElement('option');
          option.value=brand.brandId;
          option.dataset.clientId=profile.clientId;
          option.dataset.brandKitId=profile.defaultBrandKitId;
          option.dataset.truthProviderId=truth.providerId;
          option.dataset.truthBootstrap=truth.endpoints.bootstrap;
          option.dataset.truthPrepare=truth.endpoints.prepare;
          option.dataset.truthConfirm=truth.endpoints.confirm;
          option.dataset.truthUpload=truth.endpoints.upload;
          option.dataset.truthProduce=truth.endpoints.produce;
          option.textContent=(manyClients?profile.displayName+' — ':'')+brand.displayName;
          options.push(option);
        });
      });
      if(!options.length)return;
      select.replaceChildren.apply(select,options);
      if(options.some(function(option){return option.value===previous;}))select.value=previous;
      select.dispatchEvent(new Event('change'));
    }catch(_error){
      // Source-controlled ATTHA'S provider metadata remains usable if bootstrap enrichment fails.
    }
  }
  populateCreativeClientProfiles();
})();
</script>`;
  html = replaceRequired(html, "</body>", `${profileScript}</body>`);
  return html;
}
