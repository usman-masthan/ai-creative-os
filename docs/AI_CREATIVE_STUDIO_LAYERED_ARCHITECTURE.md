# AI Creative Studio — Layered Architecture Migration

## Purpose

This branch evolves the existing AI Creative OS into an editor-neutral layered creative system without replacing the current ATTHA'S truth, brand, generation, QA, rendering, approval, persistence or cost-control systems.

The architecture remains:

```text
Structured Creative Brief
→ Task Truth Confirmation
→ Immutable Task Truth Snapshot
→ Existing Governed Campaign Generation
→ Existing Creative Director
→ Existing Layout Selection
→ DesignDocument
→ Canvas Adapter (next stage)
→ Human / AI Layer Editing
→ Existing + Extended QA
→ Export
```

`DesignDocument` is deliberately independent from Konva, Fabric, DOM, SVG or any other renderer. A future canvas library is an adapter over the document, never the document model itself.

## Repository audit map

| Existing component | Decision | New responsibility |
| --- | --- | --- |
| `src/commands/runConfirmedCampaignTask.ts` | Reuse | Remains the mandatory user-facing truth-confirmed production gateway. |
| `src/taskTruth.ts` + semantic classifier | Reuse | Continue creating and validating immutable task truth snapshots before creative work. |
| `src/brandGovernance.ts` and ATTHA'S brand files | Reuse / extend | Continue authoritative brand rules; editor operations must respect protected elements. |
| `src/claimGovernance.ts` | Reuse | No copy or visual claim may escape verified truth. |
| `src/commands/generateCampaign.ts` | Reuse | Continues governed campaign/copy generation. |
| Creative Director modules | Reuse / extend later | Continue reviewing creative direction; later review assembled DesignDocuments. |
| `src/layouts/atthas.ts` | Reuse | Layout family selection remains authoritative. New geometry resolver converts layout intent into editable coordinates. |
| `src/m3Renderer.ts` / poster renderer | Reuse during migration | Existing deterministic renderer remains production-safe while layered renderer/export adapter is built. |
| Gemini image providers | Reuse | Continue server-side asset generation only; promotional typography/logo remain native layers. |
| Visual QA + final-art QA | Reuse / extend later | Existing gates remain; later add structured layer/layout QA before final raster QA. |
| `src/dashboard/marketingManager.ts` | Extend later | Structured Creative Brief and Creative Studio editor will be added without removing current workflow. |
| campaign file store/workflow | Extend later | Persist CreativeBrief + DesignDocument + version history alongside current campaign assets. |

## Implemented in this first layered-architecture slice

### CreativeBrief contract

`src/creativeStudio/contracts/creativeBrief.ts`

A strongly typed structured intake contract now exists with deterministic normalization and validation. The contract covers client/brand, goal, product, branch, audience, vibe, output format, content requirements, brand kit and optional task truth snapshot linkage.

### Canonical DesignDocument

`src/designDocument/types.ts`

The new source-of-truth representation supports:

- text
- image
- logo
- shape
- background
- group
- mask
- artboard geometry
- brand context
- truth snapshot binding
- layout identity
- asset provenance
- visual truth class
- editability/locking
- version history

Promotional typography is represented only as native text layers. Logo layers must use `approved-brand` assets.

### Deterministic validation

`src/designDocument/validator.ts`

The validator checks IDs, dimensions, opacity, layer references, text metrics, asset provenance and logo governance. Generated assets are explicitly forbidden from being mislabeled as `VERIFIED_PRODUCT_VISUAL`.

### Local editing operations

`src/designDocument/operations.ts`

Manual move, resize, visibility, lock, reorder and text changes are deterministic in-memory document operations. They do not invoke any model. Each accepted operation creates a new document version/history entry.

Brand-critical logo layers cannot be unlocked through ordinary editor operations.

### Layer geometry resolver

`src/layoutEngine/*`

The new geometry layer converts artboard/layout/copy-zone decisions into editable rectangles with safe-area calculations. It is intentionally renderer-independent.

### Existing pipeline → DesignDocument bridge

`src/creativeStudio/designDocumentAssembler.ts` and `src/commands/generateCreativeDesign.ts`

Existing governed `CampaignCreativeOutput`, selected ATTHA'S layout and production format can now be assembled into a layered `DesignDocument` without any additional model call.

The bridge creates separate background, optional subject, headline, supporting copy, CTA, optional price and approved logo layers. This is the migration seam that allows the current production pipeline to remain stable while the new editor is introduced incrementally.

## Invariants

1. Truth confirmation remains mandatory before publishing creative work.
2. The current ATTHA'S brand/truth system remains authoritative.
3. AI image generation never owns promotional typography, price, CTA or logo layers.
4. Logo assets cannot originate from generated media.
5. Manual deterministic edits do not spend model tokens.
6. `DesignDocument` never depends on a canvas implementation.
7. Existing poster production remains available until the layered export path reaches parity.

## Next implementation milestone

The next vertical slice should connect the Marketing Manager workspace to this foundation:

1. Add structured Creative Brief UI and API payload mapping.
2. Persist `CreativeBrief` after task preparation.
3. After current governed production succeeds, persist `design-document.json` beside campaign output.
4. Add a Creative Studio route that reads the document.
5. Introduce a small Konva adapter for render/select/drag/resize only.
6. Route manual mutations through `applyDesignOperation`.
7. Add undo/redo from document snapshots.
8. Keep current M3 renderer as the final export fallback until layered export QA reaches parity.

## Explicitly not claimed complete yet

This slice does **not** claim the full Canva/Figma-style editor, selected-layer Gemini editing, segmentation, version comparison, responsive multi-format adaptation, SVG export or layered high-resolution export are finished. The purpose of this slice is to establish the contracts and migration boundary required to implement those features without a rewrite or governance regression.
