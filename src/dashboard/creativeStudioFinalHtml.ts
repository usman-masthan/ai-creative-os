import { creativeStudioEnhancedHtml } from "./creativeStudioEnhancedHtml.js";

function injectAfter(html: string, marker: string, content: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_FINAL_MARKER_MISSING: ${marker}`);
  return html.replace(marker, `${marker}${content}`);
}

function injectBefore(html: string, marker: string, content: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_FINAL_MARKER_MISSING: ${marker}`);
  return html.replace(marker, `${content}${marker}`);
}

export function creativeStudioFinalHtml(): string {
  let html = creativeStudioEnhancedHtml();
  html = injectAfter(
    html,
    '<button id="qaBtn" disabled>Final QA</button>',
    '<button id="visualQaBtn" disabled>Visual QA</button><button id="parityBtn" disabled>Parity</button><span id="approvalBadge" class="pill">Unapproved</span><button id="approveVersionBtn" disabled>Approve Version</button><button id="approvedExportBtn" class="primary" disabled>Approved PNG</button><button id="registerCampaignAssetBtn" disabled>Register Asset</button>',
  );

  const script = `<script>
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  var lastApprovalKey='';
  async function api(path,options){var response=await fetch(path,Object.assign({headers:{'content-type':'application/json'}},options||{}));var data=await response.json();if(!response.ok)throw new Error(data.error||('HTTP '+response.status));return data;}
  function project(){return window.__creativeStudioCurrentProject&&window.__creativeStudioCurrentProject();}
  function designId(){var p=project();return p&&p.document&&p.document.id;}
  function designVersion(){var p=project();return p&&p.document&&p.document.version;}
  function status(message,type){if(window.__creativeStudioSetStatus)window.__creativeStudioSetStatus(message,type);}
  function setApprovalUi(data){var approved=Boolean(data&&data.approval);var visualPass=Boolean(data&&data.finalVisualQa&&data.finalVisualQa.decision==='PASS');var hasApprovedExport=Boolean(data&&data.approvedExports&&data.approvedExports.length);$('approvalBadge').textContent=approved?('Approved v'+data.version):visualPass?('QA PASS v'+data.version):('Unapproved v'+(data?data.version:'?'));$('approvalBadge').className='pill '+(approved?'ok':visualPass?'warn':'block');$('approveVersionBtn').disabled=!visualPass||approved;$('approvedExportBtn').disabled=!approved;$('registerCampaignAssetBtn').disabled=!approved||!hasApprovedExport;}
  async function refreshApproval(){var id=designId();if(!id){$('approvalBadge').textContent='Unapproved';$('approveVersionBtn').disabled=true;$('approvedExportBtn').disabled=true;$('registerCampaignAssetBtn').disabled=true;return;}try{var data=await api('/api/studio/approval?designId='+encodeURIComponent(id));setApprovalUi(data);}catch(error){setApprovalUi(null);}}
  function update(){var ready=Boolean(designId());if($('visualQaBtn'))$('visualQaBtn').disabled=!ready;if($('parityBtn'))$('parityBtn').disabled=!ready;var key=ready?(designId()+':'+designVersion()):'';if(key!==lastApprovalKey){lastApprovalKey=key;refreshApproval();}}
  async function visualQa(){try{status('Rendering final preview for visual QA…');var result=await api('/api/studio/final-visual-qa',{method:'POST',body:JSON.stringify({designId:designId()})});var review=result.review;var issues=(review.issues||[]).slice(0,4);$('qaSummary').textContent='Flattened visual QA: '+review.decision+' · brand '+review.scores.brandVisibility+'/100 · hierarchy '+review.scores.headlineHierarchy+'/100 · legibility '+review.scores.contrastLegibility+'/100'+(issues.length?' · '+issues.join(' · '):'');$('qaBadge').textContent='Visual '+review.decision;$('qaBadge').className='pill '+(review.decision==='PASS'?'ok':review.decision==='BLOCK'?'block':'warn');await refreshApproval();status('Flattened visual QA complete: '+review.decision+'.',review.decision==='PASS'?'ok':review.decision==='BLOCK'?'error':undefined);}catch(error){status(error.message,'error');}}
  async function parity(){try{status('Checking initial layered renderer parity…');var result=await api('/api/studio/parity?designId='+encodeURIComponent(designId()));var details=Object.keys(result.checks).map(function(key){return key+': '+(result.checks[key]?'pass':'fail');}).join(' · ');$('versionSummary').textContent='Initial renderer parity: '+result.decision+' · '+details+(result.issues.length?' · '+result.issues.map(function(item){return item.message;}).join(' · '):'');status('Initial renderer parity '+result.decision+'.',result.decision==='PASS'?'ok':'error');}catch(error){status(error.message,'error');}}
  async function approveVersion(){try{if(!window.confirm('Approve the current design version for production export? Any later edit will require a new visual QA and approval.'))return;status('Approving current version…');var approval=await api('/api/studio/approve-version',{method:'POST',body:JSON.stringify({designId:designId(),approvedBy:'creative-studio-user'})});await refreshApproval();status('Approved v'+approval.designVersion+' for production export.','ok');}catch(error){status(error.message,'error');}}
  async function approvedExport(){try{status('Rendering approved production PNG…');var preset=$('exportPreset')?$('exportPreset').value:'standard';var out=await api('/api/studio/export-approved',{method:'POST',body:JSON.stringify({designId:designId(),preset:preset})});window.open(out.outputPath,'_blank','noopener');await refreshApproval();status('Approved '+out.preset+' PNG exported from v'+out.version+'.','ok');}catch(error){status(error.message,'error');}}
  async function registerCampaignAsset(){try{status('Registering approved layered asset with campaign revision history…');var result=await api('/api/studio/register-approved-asset',{method:'POST',body:JSON.stringify({designId:designId(),registeredBy:'creative-studio-user'})});status((result.alreadyRegistered?'Already registered':'Registered')+' as campaign asset '+result.assetId+' / '+result.revisionId+'; campaign remains '+result.campaignState+'.','ok');}catch(error){status(error.message,'error');}}
  function bind(){if($('visualQaBtn'))$('visualQaBtn').onclick=visualQa;if($('parityBtn'))$('parityBtn').onclick=parity;if($('approveVersionBtn'))$('approveVersionBtn').onclick=approveVersion;if($('approvedExportBtn'))$('approvedExportBtn').onclick=approvedExport;if($('registerCampaignAssetBtn'))$('registerCampaignAssetBtn').onclick=registerCampaignAsset;var meta=$('designMeta');if(meta&&window.MutationObserver)new MutationObserver(update).observe(meta,{childList:true,subtree:true});update();}
  bind();
})();
</script>`;
  html = injectBefore(html, "</body>", script);
  return html;
}
