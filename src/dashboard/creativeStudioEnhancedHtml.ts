import { creativeStudioHtml } from "./creativeStudioHtml.js";

function injectAfter(html: string, marker: string, content: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_ENHANCEMENT_MARKER_MISSING: ${marker}`);
  return html.replace(marker, `${marker}${content}`);
}

function injectBefore(html: string, marker: string, content: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_ENHANCEMENT_MARKER_MISSING: ${marker}`);
  return html.replace(marker, `${content}${marker}`);
}

export function creativeStudioEnhancedHtml(): string {
  let html = creativeStudioHtml();

  html = injectAfter(
    html,
    '<button id="exportBtn" class="primary" disabled>Export PNG</button>',
    '<button id="exportSvgBtn" disabled>Export SVG</button>',
  );

  html = injectBefore(
    html,
    '<p class="note">Verified product visuals, price layers, logos, and unsegmented composite backgrounds are protected from destructive AI editing.</p>',
    `<div class="section" style="margin-top:14px">
      <h3>Subject Separation</h3>
      <p class="note">Separate the real product from a composite image before editing its background. Original foreground pixels are preserved; only the hidden background plate is repaired.</p>
      <button id="segmentBtn" class="secondary" style="width:100%" disabled>Separate Selected Product</button>
    </div>`,
  );

  html = injectBefore(
    html,
    '<div class="section" style="margin-top:16px"><h3>QA</h3>',
    `<div class="section" style="margin-top:16px">
      <h3>Creative Director</h3>
      <button id="directorReviewBtn" class="secondary" style="width:100%" disabled>Review Layered Design</button>
      <button id="autoPolishBtn" class="secondary" style="width:100%;margin-top:7px" disabled>Apply Safe Auto-Polish</button>
      <div id="directorReviewSummary" class="note" style="margin-top:8px">No layered review yet.</div>
    </div>
    <div class="section">
      <h3>Design Directions</h3>
      <p class="note">Create three composition directions from the same governed copy, facts and assets with no additional creative-generation call.</p>
      <button id="directionsBtn" class="secondary" style="width:100%" disabled>Generate 3 Directions</button>
    </div>
    <div class="section">
      <h3>Format Adaptation</h3>
      <div class="field"><select id="adaptPreset"><option value="instagram-square">Instagram Square — 1:1</option><option value="instagram-portrait">Instagram Portrait — 4:5</option><option value="instagram-story">Instagram Story — 9:16</option><option value="facebook-post">Facebook Post — 4:5</option></select></div>
      <button id="adaptBtn" class="secondary" style="width:100%" disabled>Create Adapted Design</button>
    </div>
    <div class="section">
      <h3>Version History</h3>
      <div class="row"><div class="field"><label>From</label><input id="versionFrom" type="number" min="1" value="1" /></div><div class="field"><label>To</label><input id="versionTo" type="number" min="1" value="1" /></div></div>
      <div class="toolbar-row"><button id="compareVersionsBtn" class="secondary" disabled>Compare</button><button id="restoreVersionBtn" class="secondary" disabled>Restore From</button></div>
      <div id="versionSummary" class="note">Load a design to compare or restore persisted versions.</div>
    </div>`,
  );

  html = injectBefore(
    html,
    '<div id="truthModal" class="modal hidden">',
    `<div id="directionModal" class="modal hidden"><div class="modal-card" style="width:min(1180px,96vw)"><h2>Choose a Design Direction</h2><p class="note">All three directions use the same governed facts, copy, product provenance and brand assets. Only composition/layout changes.</p><div id="directionGrid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px"></div><div class="modal-actions"><button id="closeDirections" class="secondary">Close</button></div></div></div>
`,
  );

  html = injectBefore(
    html,
    'function currentDoc(){return state.project&&state.project.document;}',
    `window.__creativeStudioLoadProject=loadProject;
  window.__creativeStudioSetStatus=setStatus;
  window.__creativeStudioCurrentProject=function(){return state.project;};
  window.__creativeStudioSelectedLayer=function(){var doc=state.project&&state.project.document;return doc?doc.layers.find(function(layer){return layer.id===state.selectedLayerId;}):null;};
  `,
  );

  const enhancementScript = `<script>
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  async function api(path,options){var response=await fetch(path,Object.assign({headers:{'content-type':'application/json'}},options||{}));var data=await response.json();if(!response.ok)throw new Error(data.error||('HTTP '+response.status));return data;}
  function project(){return window.__creativeStudioCurrentProject&&window.__creativeStudioCurrentProject();}
  function selectedLayer(){return window.__creativeStudioSelectedLayer&&window.__creativeStudioSelectedLayer();}
  function load(projectValue){if(!window.__creativeStudioLoadProject)throw new Error('Creative Studio project hook is unavailable.');window.__creativeStudioLoadProject(projectValue);updateControls();}
  function status(message,type){if(window.__creativeStudioSetStatus)window.__creativeStudioSetStatus(message,type);}
  function designId(){var value=project();return value&&value.document&&value.document.id;}
  async function refreshDesign(id){var next=await api('/api/studio/project?designId='+encodeURIComponent(id));load(next);return next;}
  function updateControls(){var p=project(),ready=Boolean(p&&p.document);['exportSvgBtn','segmentBtn','directorReviewBtn','autoPolishBtn','directionsBtn','adaptBtn','compareVersionsBtn','restoreVersionBtn'].forEach(function(id){var el=$(id);if(el)el.disabled=!ready;});if(!ready)return;var current=p.state&&p.state.currentVersion?p.state.currentVersion:p.document.version;var max=p.state&&p.state.maxVersion?p.state.maxVersion:current;$('versionTo').value=String(current);$('versionTo').max=String(max);$('versionFrom').max=String(max);if(Number($('versionFrom').value)>=current)$('versionFrom').value=String(Math.max(1,current-1));}

  async function exportSvg(){try{status('Rendering standalone SVG…');var out=await api('/api/studio/export-svg',{method:'POST',body:JSON.stringify({designId:designId()})});window.open(out.outputPath,'_blank','noopener');status('Standalone SVG exported from DesignDocument.','ok');}catch(error){status(error.message,'error');}}

  async function segment(){var layer=selectedLayer();if(!layer){status('Select a background or image layer first.','error');return;}if(layer.type!=='background'&&layer.type!=='image'){status('Subject separation requires a background or image layer.','error');return;}try{status('Separating real product pixels from the background…');var hint=$('productId')&&$('productId').value.trim();var result=await api('/api/studio/segment',{method:'POST',body:JSON.stringify({designId:designId(),layerId:layer.id,subjectHint:hint||undefined})});await refreshDesign(result.designId);status('Product separated. Original foreground pixels preserved.','ok');}catch(error){status(error.message,'error');}}

  async function directorReview(){try{status('Creative Director is reviewing the layered design…');var review=await api('/api/studio/ai/review',{method:'POST',body:JSON.stringify({designId:designId()})});var issues=(review.issues||[]).slice(0,4).map(function(item){return (item.severity||'issue')+': '+item.message;});$('directorReviewSummary').textContent='Score '+review.overallScore+'/10'+(issues.length?' · '+issues.join(' · '):' · No major issues returned.');status('Layered Creative Director review complete.','ok');}catch(error){status(error.message,'error');}}

  async function autoPolish(){try{status('Applying deterministic low-risk fixes…');var result=await api('/api/studio/auto-polish',{method:'POST',body:JSON.stringify({designId:designId()})});await refreshDesign(result.designId);var count=(result.applied||[]).length;$('directorReviewSummary').textContent=count?('Auto-polish applied '+count+' safe fix(es): '+result.applied.map(function(item){return item.layerId+' — '+item.summary;}).join(' · ')):'No safe deterministic fixes were required.';status(count?'Safe auto-polish applied.':'No safe auto-polish changes required.','ok');}catch(error){status(error.message,'error');}}

  function directionCard(direction){return '<article style="border:1px solid var(--line);background:#111315;border-radius:10px;padding:10px;display:grid;gap:8px"><img src="'+esc(direction.previewUrl)+'" alt="'+esc(direction.name)+'" style="width:100%;aspect-ratio:4/5;object-fit:contain;background:#090a0b;border-radius:7px"/><div><strong>'+esc(direction.id+' · '+direction.name)+'</strong><p class="note" style="margin:5px 0 0">'+esc(direction.rationale)+'</p></div><button class="secondary" data-open-direction="'+esc(direction.designId)+'">Open Direction</button></article>';}
  async function generateDirections(){try{status('Creating three governed composition directions…');var result=await api('/api/studio/directions',{method:'POST',body:JSON.stringify({designId:designId(),newDesignPrefix:designId()+'-directions-'+Date.now()})});$('directionGrid').innerHTML=result.directions.map(directionCard).join('');$('directionModal').classList.remove('hidden');status('Three design directions ready for comparison.','ok');}catch(error){status(error.message,'error');}}

  async function adapt(){try{var preset=$('adaptPreset').value;status('Recomposing design for '+preset+'…');var result=await api('/api/studio/adapt',{method:'POST',body:JSON.stringify({designId:designId(),preset:preset,newDesignId:designId()+'-'+preset+'-'+Date.now()})});await refreshDesign(result.designId);status('Adapted '+result.width+'×'+result.height+' design opened.','ok');}catch(error){status(error.message,'error');}}

  async function compareVersions(){try{var from=Number($('versionFrom').value),to=Number($('versionTo').value);var result=await api('/api/studio/compare',{method:'POST',body:JSON.stringify({designId:designId(),fromVersion:from,toVersion:to})});var changes=(result.layerChanges||[]);var summary='v'+from+' → v'+to+': '+changes.length+' layer change(s)';if(result.artboardChanged)summary+=' · artboard changed';if(result.layoutChanged)summary+=' · layout changed';if(changes.length)summary+=' · '+changes.slice(0,5).map(function(change){return change.layerId+' ['+change.fields.join(', ')+']';}).join(' · ');$('versionSummary').textContent=summary;status('Version comparison complete.','ok');}catch(error){status(error.message,'error');}}

  async function restoreVersion(){try{var source=Number($('versionFrom').value);if(!window.confirm('Restore design content from v'+source+' as a new revision?'))return;status('Restoring v'+source+' as a new revision…');var result=await api('/api/studio/restore',{method:'POST',body:JSON.stringify({designId:designId(),sourceVersion:source})});await refreshDesign(result.designId);$('versionSummary').textContent='Restored v'+source+' as new v'+result.restoredVersion+'.';status('Version restored without overwriting history.','ok');}catch(error){status(error.message,'error');}}

  function bind(){var svg=$('exportSvgBtn'),segmentButton=$('segmentBtn'),director=$('directorReviewBtn'),polish=$('autoPolishBtn'),directions=$('directionsBtn'),adaptButton=$('adaptBtn'),compare=$('compareVersionsBtn'),restore=$('restoreVersionBtn');if(svg)svg.onclick=exportSvg;if(segmentButton)segmentButton.onclick=segment;if(director)director.onclick=directorReview;if(polish)polish.onclick=autoPolish;if(directions)directions.onclick=generateDirections;if(adaptButton)adaptButton.onclick=adapt;if(compare)compare.onclick=compareVersions;if(restore)restore.onclick=restoreVersion;$('closeDirections').onclick=function(){$('directionModal').classList.add('hidden');};$('directionGrid').addEventListener('click',function(event){var button=event.target.closest('[data-open-direction]');if(!button)return;refreshDesign(button.dataset.openDirection).then(function(){$('directionModal').classList.add('hidden');status('Selected design direction opened.','ok');}).catch(function(error){status(error.message,'error');});});var meta=$('designMeta');if(meta&&window.MutationObserver)new MutationObserver(updateControls).observe(meta,{childList:true,subtree:true});updateControls();}
  bind();
})();
</script>`;

  html = injectBefore(html, "</body>", enhancementScript);
  return html;
}
