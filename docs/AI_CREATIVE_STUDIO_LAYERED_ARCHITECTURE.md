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
| Existing Creative Director modules | Reuse / extend | Continue concept review; `src/creativeDirectorLayered.ts` now reviews assembled DesignDocuments. |
| `src/layouts/atthas.ts` | Reuse | Layout family selection remains authoritative. Geometry is converted into editable coordinates. |
| `src/m3Renderer.ts` / poster renderer | Reuse | Existing renderer remains available while layered export is adopted. Existing Chrome render infrastructure is reused by layered PNG export. |
| Gemini image providers | Reuse | Continue server-side asset generation only; promotional typography/logo remain native layers. |
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

### Stage E — Persistence and human-in-the-loop editing

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

The isolation blocker is intentional: destructive image editing is refused until subject separation exists.

### Stage G — QA and Creative Director review

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

### Stage H — Layered export

`src/creativeStudio/renderDesignDocument.ts` renders directly from DesignDocument.

Current server export:

- PNG
- Standard resolution
- High Resolution (2×)
- 4K-style scale (4× source artboard dimensions)

Export excludes editor selection boxes, guides, grids and UI. Typography is rendered from native text layers rather than being baked into generated imagery.

The existing Chrome renderer infrastructure is reused, but the exported HTML is generated from DesignDocument rather than the old flattened poster template.

### Responsive / multi-format adaptation

`src/commands/adaptCreativeDesign.ts` implements format adaptation for:

- Instagram Square 1:1
- Instagram Portrait 4:5
- Instagram Story 9:16
- Facebook Post 4:5

Adaptation does not stretch the source canvas. It chooses the corresponding ATTHA'S layout family, recomputes geometry and typography scale, preserves copy/assets/truth/logo relationships, and creates a new independent DesignDocument project.

### Subject segmentation architecture

`src/creativeStudio/segmentation/types.ts` defines a provider-neutral segmentation contract.

`src/commands/segmentCreativeSubject.ts` can convert one composite image into independent background + subject layers while preserving visual truth provenance. A verified subject remains protected and non-AI-editable.

No segmentation model/provider has been selected or wired to the public Studio UI yet. Until that happens, unsafe composite-background replacement remains blocked.

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
POST /api/studio/ai/text
POST /api/studio/ai/image
POST /api/studio/ai/review
GET  /api/studio/adaptation-presets
POST /api/studio/adapt
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
8. Paid image generation/editing still requires the repository's explicit paid-media flag.
9. Verified product visuals cannot silently degrade into generic generated imagery.
10. Existing campaign spend tracking records paid Studio image edits.

## Remaining limitations / next hardening milestone

The following are intentionally not claimed complete:

1. **Active segmentation provider** — the contract/command exist, but a production provider still needs selection, integration and calibration.
2. **Full ATTHA'S logo lockups** — the repository currently contains the approved A/fork working master; full Burger/Restaurant vector lockups remain listed as pending brand assets.
3. **JPG export** — server-side layered PNG export is implemented; JPG remains pending.
4. **SVG export** — the document is vector-friendly and the Studio itself uses SVG, but a hardened standalone SVG export contract remains pending.
5. **Mask rendering** — mask is represented in the schema but the layered server renderer currently rejects unsupported masks rather than silently flattening them.
6. **Arbitrary version compare/restore UI** — every version is persisted and undo/redo work; dedicated compare/restore UX is still pending.
7. **AI automatic layout polish** — Creative Director produces structured recommendations; deterministic safe auto-fixes are not yet applied automatically.
8. **Konva adapter** — not required for the current MVP because native SVG supports the implemented interactions without a new dependency. If richer transforms/multi-select demand it, Konva can be added behind the existing adapter boundary.
9. **Visual regression calibration** — the layered exporter should be visually calibrated against the existing M3 renderer before it becomes the sole production renderer.

## Local development

Start the existing Marketing Manager server:

```bash
npm run marketing:workspace
```

Then use:

```text
/workspace  → existing Marketing Manager
/studio     → new layered Creative Studio
```

The two experiences intentionally share the same truth/generation backend instead of creating competing creative pipelines.

## Branch policy

Development for this migration is isolated on `layered-architecture`. The draft pull request exists to exercise the repository's pull-request CI workflow. It is not a signal that the branch should be merged into `main` while the migration is still under active development.
