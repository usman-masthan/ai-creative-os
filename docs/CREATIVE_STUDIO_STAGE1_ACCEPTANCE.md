# AI Creative Studio — Stage 1 Acceptance Matrix

This document defines the acceptance status of the `layered-architecture` branch. It is intentionally separate from `main`. The draft PR is a CI surface only and must remain unmerged until explicit approval.

## Stage 1 product goal

A user can move from a structured marketing brief to a governed creative, open it as editable layered design data, refine it manually or with scoped AI assistance, review alternatives, run QA, adapt formats, preserve history, and export a clean final asset without bypassing task truth or brand governance.

## Acceptance matrix

| Capability | Status | Acceptance evidence |
| --- | --- | --- |
| Structured Creative Brief | PASS | `CreativeBrief` contract/schema + `/studio` intake UI. |
| Existing truth confirmation reused | PASS | Studio calls existing `/api/ui/prepare` and `/api/ui/confirm`; no parallel fact system. |
| Immutable task truth remains authoritative | PASS | Design imports and Studio QA/edit routes bind back to campaign trace task snapshot. |
| Existing campaign generation reused | PASS | Studio uses existing `/api/ui/produce`; no competing generation pipeline. |
| Existing Creative Director reused | PASS | Existing campaign Creative Director remains; layered review extends it after assembly. |
| Canonical renderer-neutral DesignDocument | PASS | `src/designDocument/*`; no canvas-library types in core document. |
| Layered native typography | PASS | Headline/supporting/CTA/price are native text layers. |
| Approved logo as separate layer | PASS WITH ASSET LIMIT | Approved A/fork working master is enforced. Full official Burger/Restaurant lockups are still pending source assets in the brand manifest. |
| Layered canvas MVP | PASS | `/studio` native SVG adapter supports selection, drag, safe guides and deterministic edits. |
| Manual editing costs zero model calls | PASS | Geometry/text styling/visibility/order/duplicate/delete operations are deterministic document mutations. |
| Undo / redo | PASS | Persistent version snapshots + cursor. |
| Arbitrary version compare | PASS | `/api/studio/compare` returns layer/property deltas. |
| Restore old version without destroying history | PASS | `/api/studio/restore` restores content as a new revision. |
| Scoped AI text editing | PASS | Only selected text layer changes; price/invented numeric claims are protected. |
| Scoped AI image/background editing | PASS | Only isolated selected media layer changes; verified product imagery and unsegmented composites are protected. |
| Subject segmentation / product separation | PASS WITH CALIBRATION GATE | Gemini polygon segmentation preserves original foreground pixels in an SVG cutout; only hidden background plate is generatively repaired. Requires empirical product-photo calibration before default automatic use. |
| Multiple design directions | PASS | Three deterministic A/B/C composition directions are persisted and previewed side-by-side without extra creative-generation calls. |
| Deterministic design QA | PASS | Checks structure, logo, fonts, colors, safe areas, collisions, text overflow, price truth and branch availability. |
| Low-risk auto-polish | PASS | Deterministic corrections for safe margins, minimum logo size, approved fonts and overflow risk; no copy/price/product mutation. |
| Layered Creative Director review | PASS | Structured hierarchy/composition/brand/readability/product/CTA review persisted per design. |
| Flattened final visual QA | PASS | Final DesignDocument PNG is reviewed by the existing FinalArt QA provider after deterministic blockers are cleared. |
| Initial renderer migration parity | PASS | Version 1 can be compared against governed creative/format/layout/native copy/font/logo contract. |
| PNG export | PASS | Standard, 2× high-resolution and 4× artboard scale. |
| SVG export | PASS | Standalone source-preserving SVG export. |
| Rect / ellipse mask rendering | PASS | HTML/PNG and SVG render paths support rotated rect/ellipse masks. Multiple visible masks targeting the same layer are rejected explicitly. |
| Multi-format adaptation | PASS | 1:1, 4:5 and 9:16 recomposition creates new DesignDocuments rather than stretching. |
| Cost controls | PASS | Manual edits are free; image generation/editing and segmentation background repair use existing paid-media gates/spend tracking. |
| Existing campaign lifecycle retained | PASS | Existing campaign store/workflow, approval and publication infrastructure remain available. |
| JPG export | DEFERRED | No stable dependency-free JPEG encoder is present. PNG/SVG remain supported instead of adding a fragile native dependency only for conversion. |
| Full official logo lockups | EXTERNAL BLOCKER | Repository manifest still lists full Burger/Restaurant vector lockups as pending owner-supplied assets. They must not be recreated with AI/substitute fonts. |
| Konva-specific adapter | OPTIONAL / DEFERRED | Native SVG already satisfies Stage 1 interactions. `DesignDocument` remains compatible with a future Konva adapter if richer multi-select/transform UX requires it. |

## Required safety invariants

Stage 1 is not accepted if any of the following regress:

1. Campaign creative production must still pass through task truth confirmation.
2. AI must not invent or silently overwrite price, offer, branch, contact, campaign date or product facts.
3. Generated media must never be reclassified as a verified product visual.
4. Verified product foreground pixels must remain protected after segmentation.
5. Logos must originate from approved source-controlled assets.
6. Promotional typography must remain native/editable rather than baked into image generation.
7. Manual geometry/styling/history operations must not invoke a model.
8. AI image operations must target a single isolated layer.
9. Deterministic blockers must be resolved before final visual QA/export approval.
10. Restoring a version must create a new revision rather than erasing history.

## CI acceptance gate

The repository's existing pull-request workflow executes:

```bash
npm ci
npm run check
```

where `npm run check` runs strict TypeScript type checking and the complete Node test suite.

Because branch pushes alone do not trigger this workflow, draft PR #51 is intentionally retained only to execute this CI gate. It must remain draft and unmerged.

## Stage 1 definition of done

Stage 1 is functionally complete when the latest `layered-architecture` head is green in CI and the acceptance items above remain satisfied. The two known non-code blockers/deferred items are JPG conversion and missing official full-logo lockups; neither should be solved by weakening the current architecture.
