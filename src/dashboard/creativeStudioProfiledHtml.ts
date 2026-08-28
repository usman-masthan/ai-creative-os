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
    `<select id="brandId"><option value="ATTHAS_BURGER" ${fallbackAttributes}>ATTHA'S Burger</option><option value="ATTHAS_RESTAURANT" ${fallbackAttributes}>ATTHA'S Restaurant</option></select><div id="brandKitPreview" style="margin-top:8px;border:1px solid var(--line);border-radius:8px;padding:9px;background:#121416"><div class="note">Brand Kit preview loads from the registered client profile.</div></div>`,
  );

  html = replaceRequired(
    html,
    `<div class="checks" style="margin-bottom:10px"><label class="chip"><input type="checkbox" id="showPrice" /> Price</label><label class="chip"><input type="checkbox" id="showProduct" checked /> Product name</label><label class="chip"><input type="checkbox" id="showBranch" /> Branch</label><label class="chip"><input type="checkbox" id="showCta" checked /> CTA</label></div>`,
    `<div class="checks" style="margin-bottom:10px"><label class="chip"><input type="checkbox" id="showPrice" /> Price</label><label class="chip"><input type="checkbox" id="showOffer" /> Offer</label><label class="chip"><input type="checkbox" id="showProduct" checked /> Product name</label><label class="chip"><input type="checkbox" id="showBranch" /> Branch</label><label class="chip"><input type="checkbox" id="showCta" checked /> CTA</label><label class="chip"><input type="checkbox" id="showContactDetails" /> Contact details</label><label class="chip"><input type="checkbox" id="showCampaignDates" /> Campaign dates</label></div><div class="field"><label>Headline direction <span class="note">optional</span></label><input id="headlineDirection" maxlength="180" placeholder="Short, bold, premium; lead with craving." /></div><div class="field"><label>Custom creative instructions <span class="note">optional</span></label><textarea id="customInstructions" maxlength="800" placeholder="Creative direction only. Business facts still require truth confirmation."></textarea><div class="note">Offer, contact and date content may use only facts confirmed by the task truth gate. These controls never authorize invented values.</div></div>`,
  );

  html = replaceRequired(
    html,
    `clientId:'T001',brandId:$('brandId').value`,
    `clientId:$('brandId').selectedOptions[0].dataset.clientId,brandId:$('brandId').value`,
  );
  html = replaceRequired(
    html,
    `contentRequirements:{showPrice:$('showPrice').checked,showOffer:$('goal').value.toLowerCase().indexOf('offer')>=0,showCTA:$('showCta').checked,showProductName:$('showProduct').checked,showBranch:$('showBranch').checked,showContactDetails:false,showCampaignDates:false}`,
    `contentRequirements:{showPrice:$('showPrice').checked,showOffer:$('showOffer').checked||$('goal').value.toLowerCase().indexOf('offer')>=0,showCTA:$('showCta').checked,showProductName:$('showProduct').checked,showBranch:$('showBranch').checked,showContactDetails:$('showContactDetails').checked,showCampaignDates:$('showCampaignDates').checked,headlineDirection:$('headlineDirection').value.trim()||undefined,customInstructions:$('customInstructions').value.trim()||undefined}`,
  );
  html = replaceRequired(
    html,
    `brandKitId:'ATTHAS_WORKING_V1',createdAt:new Date().toISOString()`,
    `brandKitId:$('brandId').selectedOptions[0].dataset.brandKitId,createdAt:new Date().toISOString()`,
  );
  html = replaceRequired(
    html,
    `function campaignType(goal,product){var g=goal.toLowerCase();if(g.indexOf('offer')>=0)return 'OFFER';`,
    `function campaignType(goal,product,showOffer){var g=goal.toLowerCase();if(showOffer||g.indexOf('offer')>=0)return 'OFFER';`,
  );
  html = replaceRequired(
    html,
    `var raw=[brief.goal,brief.description,product?('featuring '+product):'',brief.branchId||'',brief.vibe.join(' '),brief.contentRequirements.showPrice?'show price':'no price',fmt.channel,fmt.assetType].filter(Boolean).join('. ');return {rawRequest:raw,brandId:brief.brandId,branchScope:brief.branchId||'BRAND_WIDE',campaignType:campaignType(brief.goal,product),objective:brief.description,`,
    `var raw=[brief.goal,brief.description,product?('featuring '+product):'',brief.branchId||'',brief.vibe.join(' '),brief.contentRequirements.showPrice?'show price':'no price',brief.contentRequirements.showOffer?'show only a confirmed offer':'no offer requested',brief.contentRequirements.showContactDetails?'include only confirmed branch contact details':'',brief.contentRequirements.showCampaignDates?'include only confirmed campaign dates':'',brief.contentRequirements.headlineDirection?('headline direction: '+brief.contentRequirements.headlineDirection):'',brief.contentRequirements.customInstructions?('creative instructions: '+brief.contentRequirements.customInstructions):'',fmt.channel,fmt.assetType].filter(Boolean).join('. ');var objective=[brief.description,brief.contentRequirements.headlineDirection?('Headline direction: '+brief.contentRequirements.headlineDirection):'',brief.contentRequirements.customInstructions?('Creative instructions: '+brief.contentRequirements.customInstructions):''].filter(Boolean).join('. ');return {rawRequest:raw,brandId:brief.brandId,branchScope:brief.branchId||'BRAND_WIDE',campaignType:campaignType(brief.goal,product,brief.contentRequirements.showOffer),objective:objective,`,
  );

  html = replaceRequired(
    html,
    `function selectedVibes(){`,
    `function truthEndpoint(name){var option=$('brandId').selectedOptions[0];if(!option)throw new Error('Select a brand first.');var key='truth'+name.charAt(0).toUpperCase()+name.slice(1);var path=option.dataset[key];if(!path)throw new Error('Truth provider '+name+' endpoint is unavailable for the selected client.');return path;}\n  async function reloadTruthBootstrap(){state.uiBootstrap=await api(truthEndpoint('bootstrap'));populateBranches();}\n  function selectedVibes(){`,
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
    `var project=await api('/api/studio/open',{method:'POST',body:JSON.stringify({campaignId:state.prepared.campaignId,brief:state.brief})});loadProject(project);`,
    `var project=await api('/api/studio/open',{method:'POST',body:JSON.stringify({campaignId:state.prepared.campaignId,brief:state.brief})});var orchestrationLink=await api('/api/studio/orchestration/link',{method:'POST',body:JSON.stringify({designId:project.document.id,orchestrationId:state.orchestration.id})});if(!orchestrationLink.linked)throw new Error('Creative Orchestrator provenance could not be linked to the design.');var orchestrationExecution=await api('/api/studio/orchestration/complete',{method:'POST',body:JSON.stringify({designId:project.document.id,orchestrationId:state.orchestration.id})});if(!orchestrationExecution||orchestrationExecution.extraModelCallsAddedByOrchestrator!==0)throw new Error('Creative Orchestrator execution audit could not be completed safely.');project.orchestration=state.orchestration;project.orchestrationExecution=orchestrationExecution;loadProject(project);`,
  );

  const profileScript = `<script>
(function(){
  'use strict';
  function addText(parent,label,value){
    var row=document.createElement('div');row.style.marginTop='7px';
    var strong=document.createElement('strong');strong.textContent=label;strong.style.display='block';strong.style.fontSize='10px';strong.style.color='#aaa';
    var text=document.createElement('div');text.textContent=value;text.style.fontSize='11px';text.style.lineHeight='1.4';
    row.appendChild(strong);row.appendChild(text);parent.appendChild(row);
  }
  function renderBrandKitPreview(option){
    var panel=document.getElementById('brandKitPreview');if(!panel)return;panel.replaceChildren();
    var preview=null;try{preview=option&&option.dataset.brandKitPreview?JSON.parse(option.dataset.brandKitPreview):null;}catch(_error){}
    if(!preview){var note=document.createElement('div');note.className='note';note.textContent='Brand Kit preview is unavailable until the registered client profile loads.';panel.appendChild(note);return;}
    var header=document.createElement('div');header.style.display='flex';header.style.gap='9px';header.style.alignItems='center';
    var img=document.createElement('img');img.src=preview.logoUrl;img.alt='Approved brand logo';img.style.width='58px';img.style.height='44px';img.style.objectFit='contain';img.style.background='#fff';img.style.borderRadius='6px';img.style.padding='4px';
    var title=document.createElement('div');var name=document.createElement('strong');name.textContent='Active Brand Kit';name.style.fontSize='12px';var id=document.createElement('div');id.className='note';id.textContent=option.dataset.brandKitId+' · '+preview.approvedLogoAssetId;title.appendChild(name);title.appendChild(id);header.appendChild(img);header.appendChild(title);panel.appendChild(header);
    var swatches=document.createElement('div');swatches.style.display='flex';swatches.style.flexWrap='wrap';swatches.style.gap='4px';swatches.style.marginTop='8px';(preview.colours||[]).forEach(function(color){var chip=document.createElement('span');chip.title=color;chip.style.width='20px';chip.style.height='20px';chip.style.borderRadius='5px';chip.style.background=color;chip.style.border='1px solid #ffffff33';swatches.appendChild(chip);});panel.appendChild(swatches);
    if(preview.typography)addText(panel,'Typography',preview.typography.display+' · '+preview.typography.body+' · '+preview.typography.price);
    if(preview.approvedGraphicElements&&preview.approvedGraphicElements.length)addText(panel,'Approved graphical elements',preview.approvedGraphicElements.join(' · '));
    if(preview.photographyDirection&&preview.photographyDirection.length)addText(panel,'Photography direction',preview.photographyDirection.join('  |  '));
  }
  function syncOfferControl(){var goal=document.getElementById('goal'),offer=document.getElementById('showOffer');if(!goal||!offer)return;if(goal.value.toLowerCase().indexOf('offer')>=0)offer.checked=true;}
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
          option.dataset.brandKitPreview=JSON.stringify(brand.brandKitPreview||null);
          option.textContent=(manyClients?profile.displayName+' — ':'')+brand.displayName;
          options.push(option);
        });
      });
      if(!options.length)return;
      select.replaceChildren.apply(select,options);
      if(options.some(function(option){return option.value===previous;}))select.value=previous;
      if(!select.dataset.brandKitPreviewBound){select.addEventListener('change',function(){renderBrandKitPreview(select.selectedOptions[0]);});select.dataset.brandKitPreviewBound='true';}
      renderBrandKitPreview(select.selectedOptions[0]);
      select.dispatchEvent(new Event('change'));
    }catch(_error){
      // Source-controlled ATTHA'S provider metadata remains usable if bootstrap enrichment fails.
    }
  }
  var goal=document.getElementById('goal');if(goal)goal.addEventListener('change',syncOfferControl);syncOfferControl();
  populateCreativeClientProfiles();
})();
</script>`;
  html = replaceRequired(html, "</body>", `${profileScript}</body>`);
  return html;
}
