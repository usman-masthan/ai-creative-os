# AI Creative Studio — Layered Architecture Migration

## Purpose

The `layered-architecture` branch evolves the existing AI Creative OS into an editor-neutral layered creative system without replacing the current ATTHA'S truth, brand, campaign generation, Creative Director, QA, rendering, approval, persistence or cost-control systems.

The implemented architecture is now:

```text
Structured Creative Brief
→ Existing Task Truth Confirmation
→ Immutable Task Truth Snapshot
→ Existing Governed Campaign Generation
→ Existing Creative Director
→ Existing ATTHA'S Layout Selection
→ DesignDocument
→ Native SVG Studio Adapter
→ Human / Scoped AI Layer Editing
→ Optional Source-Preserving Subject Separation
→ Deterministic Layered QA
→ Layered Creative Director Review
→ DesignDocument Export
```

`DesignDocument` is deliberately independent from Konva, Fabric, DOM, SVG or any other renderer. The current Studio uses a native SVG adapter because the existing frontend is server-generated HTML/TypeScript with no framework dependency. Konva can replace or augment the adapter later without changing the document contract.

## Repository audit map

| Existing component | Decision | Layered responsibility |
| --- | --- | --- |
| `src/commands/runConfirmedCampaignTask.ts` | Reuse | Remains the mandatory user-facing truth-confirmed production gateway. |
| `src/taskTruth.ts` + semantic classifier | Reuse | Continue creating and validating immutable task truth snapshots before creative work. |
| `src/brandGovernance.ts` and ATTHA'S brand files | Reuse / extend | Continue authoritative brand rules; editor operations protect approved logos and brand tokens. |
| `src/claimGovernance.ts` | Reuse | No generated copy or visual claim may escape verified truth. |
| `src/commands/generateCampaign.ts` | Reuse | Continues governed campaign/copy generation. |
| Existing Creative Director modules | Reuse / extend | Continue concept review; `src/creativeDirectorLayered.ts` reviews assembled DesignDocuments. |
| `src/layouts/atthas.ts` | Reuse | Layout family selection remains authoritative. Geometry is converted into editable coordinates. |
| `src/m3Renderer.ts` / poster renderer | Reuse | Existing renderer remains available while layered export is adopted. Existing Chrome render infrastructure is reused by layered PNG export. |
| Gemini image/text providers | Reuse / extend | Continue generation; native Gemini segmentation uses the documented multimodal Interactions API without changing campaign generation. |
| Visual QA + final-art QA | Reuse | Existing production gates remain unchanged; deterministic DesignDocument QA is added before Studio export. |
| `src/dashboard/marketingManager.ts` | Reuse unchanged | Existing `/api/ui/*` prepare/confirm/upload/produce APIs remain the governed production path used by the Studio. |
| `src/dashboard/creativeStudio*.ts` | New extension | Adds `/studio` editor and layered project APIs without duplicating Marketing Manager production logic. |
| campaign file store/workflow | Reuse | Campaign lifecycle/spend remains authoritative. A separate design project store persists editable documents and histories. |

## Implemented phases

### Stage A — Repository audit

Completed. Existing truth, brand, Creative Director, layout, Gemini, rendering, QA, campaign workflow and Marketing Manager seams were identified before introducing new modules.

### Stage B — Contracts

Implemented:

- `CreativeBrief`
- `DesignDocument`
- text/image/logo/shape/background/group/mask layer types
- generation/asset provenance
- visual truth classification
- edit operations
- structured validation
- JSON schemas for `CreativeBrief` and `DesignDocument`

Promotional typography is represented only as native text layers. Logo layers must use approved source-controlled assets.

### Stage C — Existing pipeline → layered orchestration

`src/commands/openCreativeStudioDesign.ts` reads a completed campaign AI trace and imports only trace-backed governed output:

- immutable task truth snapshot
- final governed campaign creative
- selected ATTHA'S layout
- production format
- generated/uploaded asset provenance
- approved ATTHA'S logo asset

`src/commands/generateCreativeDesign.ts` and `src/creativeStudio/designDocumentAssembler.ts` then create the canonical editable DesignDocument without another model call.

This preserves the existing sequence:

```text
facts → user confirmation → immutable task truth → fact gate → creative production
```

### Stage D — Canvas MVP

Implemented at `/studio` using a native SVG adapter over DesignDocument.

Current capabilities:

- structured Creative Brief UI
- task truth confirmation modal
- existing governed campaign generation
- open existing campaigns
- layered artboard rendering
- select layers
- drag layers
- center snapping
- safe-area snapping
- toggled safe-area/centre guides
- edit position and dimensions
- rotate eligible layers
- opacity
- native text editing
- font/size/weight/line-height/letter-spacing/alignment/color
- visibility
- locking
- z-order changes
- duplicate eligible layers
- delete eligible layers

The SVG structure is an adapter only. `DesignDocument` remains renderer-neutral.

### Stage E — Persistence, history and human-in-the-loop editing

`src/creativeStudio/projectStore.ts` persists editable projects under runtime storage, not source control.

Persisted data includes:

- DesignDocument
- optional CreativeBrief
- immutable campaign/truth linkage
- version snapshots
- undo/redo cursor
- deterministic QA result
- layered Creative Director review
- export records

Every deterministic mutation creates a new DesignDocument version. Manual canvas operations do not invoke an AI provider.

`src/creativeStudio/versioning.ts` adds arbitrary version inspection, structural comparison and restore-as-new-revision semantics. Restoring an older state never overwrites history.

### Stage F — Scoped AI layer editing

Implemented in `src/commands/editCreativeLayer.ts`.

Text editing:

- edits exactly one selected native text layer
- uses the existing Gemini campaign provider abstraction
- validates model JSON
- blocks AI editing of the price layer
- blocks unconfirmed numeric claims
- leaves all unrelated layers untouched

Image editing:

- edits exactly one isolated image/background layer
- uses the existing Gemini image provider abstraction
- obeys `ALLOW_PAID_MEDIA`
- records model cost in the existing campaign spend workflow
- forbids generated promotional text, logo, numbers and signage
- applies anti-generic-AI aesthetic direction
- blocks AI replacement of verified product visuals
- blocks background replacement when the product is still baked into the same composite image

### Stage G — Source-preserving subject separation

Implemented with a provider-neutral contract plus a Gemini production provider.

`src/creativeStudio/segmentation/gemini.ts` uses Gemini native image understanding to request a polygon segmentation mask for the confirmed product/subject. The resulting foreground is **not regenerated**: the provider builds an SVG cutout that embeds the original source pixels and clips them with the detected polygon.

Only the occluded background plate is generatively repaired. This allows later background editing while keeping the original verified product pixels intact.

Governance rules:

- endpoint requires `GEMINI_API_KEY`
- generative background repair requires `ALLOW_PAID_MEDIA=true`
- original foreground pixels are preserved
- verified foreground stays protected/non-AI-editable
- background repair is explicitly classified as generated/runtime media
- image-generation spend is recorded in the existing campaign workflow
- deterministic DesignDocument QA runs again after separation

The implementation follows Gemini's documented polygon segmentation response (`box_2d` + polygon `mask`) instead of relying on a generative cutout to represent the product.

### Stage H — QA and Creative Director review

`src/creativeStudio/designQa.ts` performs deterministic structured QA over the editable document.

Checks currently include:

- DesignDocument validity
- visible background
- approved logo presence
- logo minimum size
- safe margins
- approved typography
- approved color tokens
- text overflow risk
- important-layer collision
- price vs immutable task truth
- branch availability vs immutable task truth

It returns `PASS`, `WARN` or `BLOCK` plus structured scores/issues.

`src/creativeDirectorLayered.ts` extends the existing Creative Director role to review the assembled structured design across hierarchy, composition, balance, typography, brand consistency, product/CTA prominence, readability, whitespace, depth, color harmony, offer clarity, image quality, authenticity and AI-artifact risk.

### Stage I — Layered export

`src/creativeStudio/renderDesignDocument.ts` renders directly from DesignDocument.

Current server export:

- PNG standard resolution
- PNG High Resolution (2×)
- PNG 4× source artboard scale
- standalone SVG

Export excludes editor selection boxes, guides, grids and UI. Typography is rendered from native text layers rather than being baked into generated imagery.

The existing Chrome renderer infrastructure is reused for PNG, but exported HTML is generated from DesignDocument rather than the old flattened poster template.

### Stage J — Responsive / multi-format adaptation

`src/commands/adaptCreativeDesign.ts` implements format adaptation for:

- Instagram Square 1:1
- Instagram Portrait 4:5
- Instagram Story 9:16
- Facebook Post 4:5

Adaptation does not stretch the source canvas. It chooses the corresponding ATTHA'S layout family, recomputes geometry and typography scale, preserves copy/assets/truth/logo relationships, and creates a new independent DesignDocument project.

## Creative Studio API surface

The existing Marketing Manager APIs remain authoritative for production:

```text
POST /api/ui/prepare
POST /api/ui/confirm
POST /api/ui/upload
POST /api/ui/produce
```

Layered Studio APIs:

```text
GET  /studio
GET  /api/studio/bootstrap
POST /api/studio/open
GET  /api/studio/project
POST /api/studio/operation
POST /api/studio/undo
POST /api/studio/redo
POST /api/studio/qa
POST /api/studio/export
POST /api/studio/export-svg
POST /api/studio/ai/text
POST /api/studio/ai/image
POST /api/studio/ai/review
POST /api/studio/segment
GET  /api/studio/adaptation-presets
POST /api/studio/adapt
GET  /api/studio/version
POST /api/studio/compare
POST /api/studio/restore
```

Runtime asset paths are not exposed directly to the browser. Studio asset/media routes validate allowed runtime or source-controlled brand paths before serving bytes.

## Invariants preserved

1. Truth confirmation remains mandatory before campaign production.
2. The current ATTHA'S brand/truth system remains authoritative.
3. AI image generation never owns promotional typography, price, CTA or logo layers.
4. Logo assets cannot originate from generated media.
5. Manual deterministic edits spend zero model tokens.
6. `DesignDocument` never depends on a canvas implementation.
7. Existing campaign generation/QA/approval remains available and unchanged.
8. Paid image generation/editing and segmentation background repair require the repository's explicit paid-media flag.
9. Verified product visuals cannot silently degrade into generic generated imagery.
10. Segmentation preserves original foreground pixels and labels generative background repair separately.
11. Existing campaign spend tracking records paid Studio image edits and segmentation background repair.
12. Version restore creates a new revision instead of destroying history.

## Remaining limitations / next hardening milestone

The following are intentionally not claimed complete:

1. **Segmentation calibration** — the production provider is integrated, but product-specific mask quality still needs empirical calibration across ATTHA'S photography before automatic use should be enabled by default in UI.
2. **Full ATTHA'S logo lockups** — the repository currently contains the approved A/fork working master; full Burger/Restaurant vector lockups remain listed as pending brand assets.
3. **JPG export** — PNG and standalone SVG export are implemented; JPG remains pending.
4. **Mask layer rendering** — mask is represented in DesignDocument but generic mask-layer rendering remains intentionally unsupported; subject segmentation currently materializes its safe cutout as an SVG image asset instead.
5. **Dedicated version-history UX** — arbitrary version API compare/restore is implemented; the current Studio UI still primarily exposes undo/redo.
6. **AI automatic layout polish** — Creative Director produces structured recommendations; deterministic safe auto-fixes are not yet applied automatically.
7. **Konva adapter** — not required for the current MVP because native SVG supports the implemented interactions without a new dependency. If richer transforms/multi-select demand it, Konva can be added behind the existing adapter boundary.
8. **Visual regression calibration** — layered PNG/SVG output should be visually calibrated against the existing M3 renderer before it becomes the sole production renderer.

## Local development

Start the existing Marketing Manager server:

```bash
npm run marketing:workspace
```

Then use:

```text
/workspace  → existing Marketing Manager
/studio     → layered Creative Studio
```

The two experiences intentionally share the same truth/generation backend instead of creating competing creative pipelines.

## Branch policy

Development for this migration is isolated on `layered-architecture`. The draft pull request exists only to exercise the repository's pull-request CI workflow. It must remain draft and unmerged into `main` until explicit approval is given later.
