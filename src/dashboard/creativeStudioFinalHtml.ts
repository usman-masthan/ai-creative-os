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
    '<button id="visualQaBtn" disabled>Visual QA</button><button id="parityBtn" disabled>Parity</button>',
  );

  const script = `<script>
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id)};
  async function api(path,options){var response=await fetch(path,Object.assign({headers:{'content-type':'application/json'}},options||{}));var data=await response.json();if(!response.ok)throw new Error(data.error||('HTTP '+response.status));return data;}
  function project(){return window.__creativeStudioCurrentProject&&window.__creativeStudioCurrentProject();}
  function designId(){var p=project();return p&&p.document&&p.document.id;}
  function status(message,type){if(window.__creativeStudioSetStatus)window.__creativeStudioSetStatus(message,type);}
  function update(){var ready=Boolean(designId());if($('visualQaBtn'))$('visualQaBtn').disabled=!ready;if($('parityBtn'))$('parityBtn').disabled=!ready;}
  async function visualQa(){try{status('Rendering final preview for visual QA…');var result=await api('/api/studio/final-visual-qa',{method:'POST',body:JSON.stringify({designId:designId()})});var review=result.review;var issues=(review.issues||[]).slice(0,4);$('qaSummary').textContent='Flattened visual QA: '+review.decision+' · brand '+review.scores.brandVisibility+'/100 · hierarchy '+review.scores.headlineHierarchy+'/100 · legibility '+review.scores.contrastLegibility+'/100'+(issues.length?' · '+issues.join(' · '):'');$('qaBadge').textContent='Visual '+review.decision;$('qaBadge').className='pill '+(review.decision==='PASS'?'ok':review.decision==='BLOCK'?'block':'warn');status('Flattened visual QA complete: '+review.decision+'.',review.decision==='PASS'?'ok':review.decision==='BLOCK'?'error':undefined);}catch(error){status(error.message,'error');}}
  async function parity(){try{status('Checking initial layered renderer parity…');var result=await api('/api/studio/parity?designId='+encodeURIComponent(designId()));var details=Object.keys(result.checks).map(function(key){return key+': '+(result.checks[key]?'pass':'fail');}).join(' · ');$('versionSummary').textContent='Initial renderer parity: '+result.decision+' · '+details+(result.issues.length?' · '+result.issues.map(function(item){return item.message;}).join(' · '):'');status('Initial renderer parity '+result.decision+'.',result.decision==='PASS'?'ok':'error');}catch(error){status(error.message,'error');}}
  function bind(){if($('visualQaBtn'))$('visualQaBtn').onclick=visualQa;if($('parityBtn'))$('parityBtn').onclick=parity;var meta=$('designMeta');if(meta&&window.MutationObserver)new MutationObserver(update).observe(meta,{childList:true,subtree:true});update();}
  bind();
})();
</script>`;
  html = injectBefore(html, "</body>", script);
  return html;
}
