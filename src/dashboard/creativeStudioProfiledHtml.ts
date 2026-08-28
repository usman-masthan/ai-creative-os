import { creativeStudioFinalHtml } from "./creativeStudioFinalHtml.js";

function replaceRequired(html: string, marker: string, replacement: string): string {
  if (!html.includes(marker)) throw new Error(`CREATIVE_STUDIO_PROFILE_MARKER_MISSING: ${marker}`);
  return html.replace(marker, replacement);
}

export function creativeStudioProfiledHtml(): string {
  let html = creativeStudioFinalHtml();

  html = replaceRequired(
    html,
    `<select id="brandId"><option value="ATTHAS_BURGER">ATTHA'S Burger</option><option value="ATTHAS_RESTAURANT">ATTHA'S Restaurant</option></select>`,
    `<select id="brandId"><option value="ATTHAS_BURGER" data-client-id="T001" data-brand-kit-id="ATTHAS_WORKING_V1">ATTHA'S Burger</option><option value="ATTHAS_RESTAURANT" data-client-id="T001" data-brand-kit-id="ATTHAS_WORKING_V1">ATTHA'S Restaurant</option></select>`,
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
        (profile.brands||[]).forEach(function(brand){
          var option=document.createElement('option');
          option.value=brand.brandId;
          option.dataset.clientId=profile.clientId;
          option.dataset.brandKitId=profile.defaultBrandKitId;
          option.textContent=(manyClients?profile.displayName+' — ':'')+brand.displayName;
          options.push(option);
        });
      });
      if(!options.length)return;
      select.replaceChildren.apply(select,options);
      if(options.some(function(option){return option.value===previous;}))select.value=previous;
      select.dispatchEvent(new Event('change'));
    }catch(_error){
      // Initial source-controlled ATTHA'S options remain usable if bootstrap enrichment fails.
    }
  }
  populateCreativeClientProfiles();
})();
</script>`;
  html = replaceRequired(html, "</body>", `${profileScript}</body>`);
  return html;
}
