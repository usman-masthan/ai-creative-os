from pathlib import Path

ROOT = Path('.')

def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    p.write_text(text.replace(old, new, 1))

# Backend list coercion accepts comma, semicolon or newline separators.
replace_once(
    'src/dashboard/workspaceProduction.ts',
    '        ? value.split(/[,\\n]/)',
    '        ? value.split(/[,;\\n]/)',
)

# Add a deterministic upload-time approval guard so invalid product assets are never persisted.
replace_once(
    'src/dashboard/workspaceProduction.ts',
    '''export function taskSnapshotFact(snapshot: TaskTruthSnapshot, key: string): unknown {\n  return snapshot.facts.find((fact) => fact.key === key)?.value;\n}\n''',
    '''export function taskSnapshotFact(snapshot: TaskTruthSnapshot, key: string): unknown {\n  return snapshot.facts.find((fact) => fact.key === key)?.value;\n}\n\nexport function assertWorkspaceProductPhotoApproval(input: {\n  productId?: string;\n  approvedForAds: boolean;\n  appearanceVerified: boolean;\n  ingredientMatchVerified: boolean;\n}): void {\n  if (!input.productId) return;\n  const missing = [\n    ...(!input.approvedForAds ? ["advertising approval"] : []),\n    ...(!input.appearanceVerified ? ["product appearance verification"] : []),\n    ...(!input.ingredientMatchVerified ? ["ingredient-match verification"] : []),\n  ];\n  if (missing.length) {\n    throw new Error(`Product photo cannot be bound until all approvals are confirmed. Missing: ${missing.join(", ")}.`);\n  }\n}\n''',
)

# Improve detailed error if an old/incomplete asset somehow reaches production.
replace_once(
    'src/dashboard/workspaceProduction.ts',
    '''    if (\n      !input.uploadedAsset.approvedForAds ||\n      !input.uploadedAsset.appearanceVerified ||\n      !input.uploadedAsset.ingredientMatchVerified\n    ) {\n      throw new Error("The uploaded product photo is not fully approved for advertising/product identity use.");\n    }''',
    '''    if (\n      !input.uploadedAsset.approvedForAds ||\n      !input.uploadedAsset.appearanceVerified ||\n      !input.uploadedAsset.ingredientMatchVerified\n    ) {\n      const missing = [\n        ...(!input.uploadedAsset.approvedForAds ? ["advertising approval"] : []),\n        ...(!input.uploadedAsset.appearanceVerified ? ["product appearance verification"] : []),\n        ...(!input.uploadedAsset.ingredientMatchVerified ? ["ingredient-match verification"] : []),\n      ];\n      throw new Error(`The bound product photo is incomplete. Re-upload after confirming: ${missing.join(", ")}.`);\n    }''',
)

# Wire the upload-time guard into the backend.
replace_once(
    'src/dashboard/marketingManager.ts',
    '''  assertWorkspaceProductionTruth,\n  assertWorkspaceUploadedAssetMatchesTask,''',
    '''  assertWorkspaceProductionTruth,\n  assertWorkspaceProductPhotoApproval,\n  assertWorkspaceUploadedAssetMatchesTask,''',
)
replace_once(
    'src/dashboard/marketingManager.ts',
    '''      const approvedForAds = data.approvedForAds === true;\n      const appearanceVerified = data.appearanceVerified === true;\n      const ingredientMatchVerified = data.ingredientMatchVerified === true;\n      const dataUrl = stringValue(data.dataUrl, "dataUrl");''',
    '''      const approvedForAds = data.approvedForAds === true;\n      const appearanceVerified = data.appearanceVerified === true;\n      const ingredientMatchVerified = data.ingredientMatchVerified === true;\n      assertWorkspaceProductPhotoApproval({\n        ...(productId ? { productId } : {}),\n        approvedForAds,\n        appearanceVerified,\n        ingredientMatchVerified,\n      });\n      const dataUrl = stringValue(data.dataUrl, "dataUrl");''',
)

# Make list fields clearer and parse comma/semicolon/newline in the browser.
old_truth = '''function truthControl(q,idx,val){const key=q.requirement.key;if(key==='branchAvailability'){const n=String(val).toLowerCase();return '<select data-q="'+idx+'"><option value="">Select</option><option value="true"'+(n==='true'||n==='yes'?' selected':'')+'>Yes — currently available</option><option value="false"'+(n==='false'||n==='no'?' selected':'')+'>No — not currently available</option></select>'}if(key==='approvedProductVisual'){return '<select data-q="'+idx+'"><option value="">Select governed source</option><option value="APPROVED_REAL_PRODUCT_PHOTO"'+(val==='APPROVED_REAL_PRODUCT_PHOTO'?' selected':'')+'>Approved real product photo</option><option value="AI_GENERATION_ALLOWED"'+(val==='AI_GENERATION_ALLOWED'?' selected':'')+'>Allow constrained AI generation</option></select>'}if(key==='price'){return '<input type="number" min="1" step="1" data-q="'+idx+'" value="'+esc(val)+'" placeholder="Enter LKR amount">'}if(['ingredients','mustInclude','mustNotInclude','cookingMethods'].includes(key)){return '<input type="text" data-q="'+idx+'" value="'+esc(Array.isArray(val)?val.join(', '):val)+'" placeholder="Comma-separated'+(key==='ingredients'?' verified items':' values; leave blank if none')+'">'}return '<input type="text" data-q="'+idx+'" value="'+esc(val)+'" placeholder="Enter current value">'}'''
new_truth = '''function truthControl(q,idx,val){const key=q.requirement.key;if(key==='branchAvailability'){const n=String(val).toLowerCase();return '<select data-q="'+idx+'"><option value="">Select</option><option value="true"'+(n==='true'||n==='yes'?' selected':'')+'>Yes — currently available</option><option value="false"'+(n==='false'||n==='no'?' selected':'')+'>No — not currently available</option></select>'}if(key==='approvedProductVisual'){return '<select data-q="'+idx+'"><option value="">Select governed source</option><option value="APPROVED_REAL_PRODUCT_PHOTO"'+(val==='APPROVED_REAL_PRODUCT_PHOTO'?' selected':'')+'>Approved real product photo</option><option value="AI_GENERATION_ALLOWED"'+(val==='AI_GENERATION_ALLOWED'?' selected':'')+'>Allow constrained AI generation</option></select>'}if(key==='price'){return '<input type="number" min="1" step="1" data-q="'+idx+'" value="'+esc(val)+'" placeholder="Enter LKR amount">'}if(['ingredients','mustInclude','mustNotInclude','cookingMethods'].includes(key)){const hints={ingredients:'Verified visible ingredients — one per line, or comma/semicolon separated',mustInclude:'Only elements that must visibly appear — one per line, or comma/semicolon separated',mustNotInclude:'Elements or serving claims that must not appear — one per line, or comma/semicolon separated',cookingMethods:'Verified cooking methods — one per line, or comma/semicolon separated'};return '<textarea rows="3" data-q="'+idx+'" placeholder="'+esc(hints[key])+'">'+esc(Array.isArray(val)?val.join('\\n'):val)+'</textarea>'}return '<input type="text" data-q="'+idx+'" value="'+esc(val)+'" placeholder="Enter current value">'}'''
replace_once('src/dashboard/marketingManagerHtml.ts', old_truth, new_truth)
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    '''if(['ingredients','mustInclude','mustNotInclude','cookingMethods'].includes(q.requirement.key))return raw.split(',').map(x=>x.trim()).filter(Boolean);''',
    '''if(['ingredients','mustInclude','mustNotInclude','cookingMethods'].includes(q.requirement.key))return raw.split(/[,;\\n]/).map(x=>x.trim()).filter(Boolean);''',
)

# Approval or file changes invalidate the previously bound asset. Upload requires all three confirmations for a product photo.
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    '''$('imageFile').onchange=()=>{state.baseImageAsset=null;if($('imageFile').files[0])notice('uploadStatus','Selected file is not uploaded yet. Click “Upload and bind selected image” before producing with this photo.','')};\n$('upload').onclick=async()=>{try{if(!state.snapshot)throw new Error('Confirm task facts first.');const f=$('imageFile').files[0];if(!f)throw new Error('Choose an image first.');const dataUrl=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)});const current=syncIntent();const d=await api('/api/ui/upload',{method:'POST',body:JSON.stringify({sessionId:state.prepared.sessionId,campaignId:state.prepared.campaignId,brandId:current.brandId,branchId:current.branchScope==='BRAND_WIDE'?undefined:current.branchScope,productId:current.productId,filename:f.name,dataUrl,approvedForAds:$('approvedForAds').checked,appearanceVerified:$('appearanceVerified').checked,ingredientMatchVerified:$('ingredientMatchVerified').checked})});state.baseImageAsset=d;notice('uploadStatus','Bound '+d.filename+' as '+d.assetId+' to this campaign/product.','good')}catch(e){state.baseImageAsset=null;notice('uploadStatus',e.message,'bad')}};''',
    '''function snapshotFact(key){return state.snapshot?.facts?.find(f=>f.key===key)?.value}\nfunction invalidateImageBinding(message){if(state.baseImageAsset){state.baseImageAsset=null;notice('uploadStatus',message,'')}else if($('imageFile').files[0])notice('uploadStatus',message,'')}\n$('imageFile').onchange=()=>{state.baseImageAsset=null;if($('imageFile').files[0])notice('uploadStatus','Selected file is not uploaded yet. Confirm approvals, then click “Upload and bind selected image”.','')};\n['approvedForAds','appearanceVerified','ingredientMatchVerified'].forEach(id=>$(id).onchange=()=>invalidateImageBinding('Image approval changed. Re-upload and bind the image so the stored asset matches the confirmations now shown.'));\n$('upload').onclick=async()=>{try{if(!state.snapshot)throw new Error('Confirm task facts first.');const f=$('imageFile').files[0];if(!f)throw new Error('Choose an image first.');const current=syncIntent();if(current.productId&&snapshotFact('approvedProductVisual')==='APPROVED_REAL_PRODUCT_PHOTO'&&(!$('approvedForAds').checked||!$('appearanceVerified').checked||!$('ingredientMatchVerified').checked))throw new Error('For an approved real product photo, tick all three approval confirmations before binding the image.');const dataUrl=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)});const d=await api('/api/ui/upload',{method:'POST',body:JSON.stringify({sessionId:state.prepared.sessionId,campaignId:state.prepared.campaignId,brandId:current.brandId,branchId:current.branchScope==='BRAND_WIDE'?undefined:current.branchScope,productId:current.productId,filename:f.name,dataUrl,approvedForAds:$('approvedForAds').checked,appearanceVerified:$('appearanceVerified').checked,ingredientMatchVerified:$('ingredientMatchVerified').checked})});state.baseImageAsset=d;notice('uploadStatus','Bound '+d.filename+' as '+d.assetId+' · Advertising ✓ · Appearance ✓ · Ingredient match ✓','good')}catch(e){state.baseImageAsset=null;notice('uploadStatus',e.message,'bad')}};''',
)

# Regression tests.
test_path = ROOT / 'tests/productionIntegrationHardening.test.ts'
test_text = test_path.read_text()
test_text = test_text.replace(
    '''  assert.deepEqual(coerceWorkspaceTruthValue("ingredients", "bun, chicken, lettuce"), ["bun", "chicken", "lettuce"]);''',
    '''  assert.deepEqual(coerceWorkspaceTruthValue("ingredients", "bun, chicken; lettuce\\nsauce"), ["bun", "chicken", "lettuce", "sauce"]);''',
    1,
)
test_text = test_text.replace(
    '''  buildWorkspaceVisualQaContext,\n  coerceWorkspaceTruthValue,''',
    '''  buildWorkspaceVisualQaContext,\n  coerceWorkspaceTruthValue,\n  assertWorkspaceProductPhotoApproval,''',
    1,
)
test_text += '''\n\ntest("product photo binding refuses incomplete approval metadata", () => {\n  assert.throws(() => assertWorkspaceProductPhotoApproval({\n    productId: "Crispy Chicken Burger",\n    approvedForAds: true,\n    appearanceVerified: false,\n    ingredientMatchVerified: true,\n  }), /product appearance verification/i);\n  assert.doesNotThrow(() => assertWorkspaceProductPhotoApproval({\n    productId: "Crispy Chicken Burger",\n    approvedForAds: true,\n    appearanceVerified: true,\n    ingredientMatchVerified: true,\n  }));\n});\n'''
test_path.write_text(test_text)

# Static UI regression: make the state-binding safeguards part of the gate.
(ROOT / 'tests/marketingManagerUploadState.test.ts').write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport { marketingManagerHtml } from "../src/dashboard/marketingManagerHtml.js";\n\ntest("Marketing Manager invalidates product-photo binding when approvals change", () => {\n  const html = marketingManagerHtml();\n  assert.match(html, /Image approval changed\\. Re-upload and bind the image/);\n  assert.match(html, /tick all three approval confirmations before binding/i);\n  assert.match(html, /Advertising ✓ · Appearance ✓ · Ingredient match ✓/);\n});\n\ntest("Marketing Manager list truth controls clearly support structured separators", () => {\n  const html = marketingManagerHtml();\n  assert.match(html, /one per line, or comma\\/semicolon separated/);\n  assert.match(html, /raw\\.split\\(\\/\\[,;\\\\n\\]\\//);\n});\n''')

print('Product-photo approval-state hardening applied.')
