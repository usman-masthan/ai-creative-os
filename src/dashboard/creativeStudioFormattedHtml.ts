import { CREATIVE_OUTPUT_FORMAT_PRESETS } from "../creativeStudio/contracts/outputFormat.js";
import { creativeStudioProfiledHtml } from "./creativeStudioProfiledHtml.js";

function replaceRequired(html: string, marker: string, replacement: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_FORMAT_MARKER_MISSING: ${marker}`);
  return html.replace(marker, replacement);
}

export function creativeStudioFormattedHtml(): string {
  let html = creativeStudioProfiledHtml();
  const presets = Object.values(CREATIVE_OUTPUT_FORMAT_PRESETS);
  const options = presets
    .map((target) => `<option value="${target.preset}">${target.label} · ${target.width}×${target.height}</option>`)
    .join("");

  html = replaceRequired(
    html,
    `<div class="field"><label>Output format</label><select id="formatPreset"><option value="instagram-portrait">Instagram Portrait — 4:5</option><option value="instagram-square">Instagram Square — 1:1</option><option value="instagram-story">Instagram Story — 9:16</option><option value="facebook-post">Facebook Post — 4:5</option></select></div>`,
    `<div class="field"><label>Output format</label><select id="formatPreset">${options}<option value="custom">Custom dimensions</option></select></div><div id="customFormatDimensions" class="row hidden"><div class="field"><label>Custom width</label><input id="customWidth" type="number" min="64" max="16384" step="1" value="1200" /></div><div class="field"><label>Custom height</label><input id="customHeight" type="number" min="64" max="16384" step="1" value="1500" /></div></div><div id="formatSummary" class="note" style="margin:-4px 0 10px">Select a governed output preset.</div>`,
  );

  html = replaceRequired(
    html,
    `<div class="field"><select id="adaptPreset"><option value="instagram-square">Instagram Square — 1:1</option><option value="instagram-portrait">Instagram Portrait — 4:5</option><option value="instagram-story">Instagram Story — 9:16</option><option value="facebook-post">Facebook Post — 4:5</option></select></div>`,
    `<div class="field"><select id="adaptPreset">${options}<option value="custom">Custom dimensions</option></select></div><div id="adaptCustomDimensions" class="row hidden"><div class="field"><label>Width</label><input id="adaptCustomWidth" type="number" min="64" max="16384" step="1" value="1200" /></div><div class="field"><label>Height</label><input id="adaptCustomHeight" type="number" min="64" max="16384" step="1" value="1500" /></div></div>`,
  );

  html = replaceRequired(
    html,
    `function formatPreset(value){if(value==='instagram-square')return {preset:value,width:1080,height:1080,channel:'instagram',assetType:'poster'};if(value==='instagram-story')return {preset:value,width:1080,height:1920,channel:'instagram',assetType:'story'};if(value==='facebook-post')return {preset:value,width:1080,height:1350,channel:'facebook',assetType:'poster'};return {preset:'instagram-portrait',width:1080,height:1350,channel:'instagram',assetType:'poster'};}`,
    `function formatPreset(value){if(value==='custom'){var width=Number($('customWidth').value),height=Number($('customHeight').value);if(!Number.isInteger(width)||width<64||width>16384||!Number.isInteger(height)||height<64||height>16384)throw new Error('Custom width and height must be whole pixels from 64 to 16384.');return {preset:'custom',width:width,height:height,channel:'custom',assetType:'custom-'+width+'x'+height};}var target=window.__creativeOutputFormats&&window.__creativeOutputFormats[value];if(!target)throw new Error('Unsupported output format: '+value);return {preset:target.preset,width:target.width,height:target.height,channel:target.channel,assetType:target.assetType};}`,
  );

  html = replaceRequired(
    html,
    `async function adapt(){try{var preset=$('adaptPreset').value;status('Recomposing design for '+preset+'…');var result=await api('/api/studio/adapt',{method:'POST',body:JSON.stringify({designId:designId(),preset:preset,newDesignId:designId()+'-'+preset+'-'+Date.now()})});await refreshDesign(result.designId);status('Adapted '+result.width+'×'+result.height+' design opened.','ok');}catch(error){status(error.message,'error');}}`,
    `async function adapt(){try{var preset=$('adaptPreset').value;var payload={designId:designId(),preset:preset,newDesignId:designId()+'-'+preset+'-'+Date.now()};if(preset==='custom'){payload.customWidth=Number($('adaptCustomWidth').value);payload.customHeight=Number($('adaptCustomHeight').value);}status('Recomposing design for '+preset+'…');var result=await api('/api/studio/adapt',{method:'POST',body:JSON.stringify(payload)});await refreshDesign(result.designId);status('Adapted '+result.width+'×'+result.height+' design opened.','ok');}catch(error){status(error.message,'error');}}`,
  );

  const registry = JSON.stringify(CREATIVE_OUTPUT_FORMAT_PRESETS).replace(/</g, "\\u003c");
  const script = `<script>
(function(){
  'use strict';
  window.__creativeOutputFormats=${registry};
  var select=document.getElementById('formatPreset');
  var custom=document.getElementById('customFormatDimensions');
  var summary=document.getElementById('formatSummary');
  var adaptSelect=document.getElementById('adaptPreset');
  var adaptCustom=document.getElementById('adaptCustomDimensions');
  function update(){
    if(!select||!custom||!summary)return;
    var isCustom=select.value==='custom';
    custom.classList.toggle('hidden',!isCustom);
    if(isCustom){
      var width=document.getElementById('customWidth').value;
      var height=document.getElementById('customHeight').value;
      summary.textContent='Custom artboard · '+width+'×'+height+' px · exact renderer dimensions; AI media uses the nearest supported source ratio when needed.';
      return;
    }
    var target=window.__creativeOutputFormats[select.value];
    summary.textContent=target?target.label+' · '+target.width+'×'+target.height+' px · deterministic layout composition.':'Select a governed output preset.';
  }
  function updateAdapt(){if(adaptSelect&&adaptCustom)adaptCustom.classList.toggle('hidden',adaptSelect.value!=='custom');}
  if(select)select.addEventListener('change',update);
  if(adaptSelect)adaptSelect.addEventListener('change',updateAdapt);
  ['customWidth','customHeight'].forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener('input',update);});
  update();updateAdapt();
})();
</script>`;
  html = replaceRequired(html, "</body>", `${script}</body>`);
  return html;
}
