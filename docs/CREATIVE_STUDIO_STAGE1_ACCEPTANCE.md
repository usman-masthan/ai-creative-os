# AI Creative Studio — Stage 1 Acceptance Matrix

This document defines the acceptance status of the `layered-architecture` branch. It is intentionally separate from `main`. The draft PR is a CI surface only and must remain unmerged until explicit approval.

## Stage 1 product goal

A user can move from a structured marketing brief to a governed creative, open it as editable layered design data, refine it manually or with scoped AI assistance, review alternatives, run QA, adapt formats, preserve history, explicitly approve an exact reviewed version, export a clean production asset, and register that asset back into the existing campaign revision history without bypassing task truth, brand governance, orchestration provenance, or campaign lifecycle roles.

## Acceptance matrix

| Capability | Status | Acceptance evidence |
| --- | --- | --- |
| Structured Creative Brief | PASS | `CreativeBrief` contract/schema + `/studio` intake UI. |
| Profile-driven Studio intake | PASS | Client, brand-kit and truth-provider metadata come from `/api/studio/bootstrap`; fixed T001 request constants are removed from the active intake flow. |
| Profile-driven Brand Kit preview | PASS | The intake displays the selected registered brand's approved logo, palette, semantic colors, display/body/price typography, approved graphical elements and photography direction. Logo bytes are served through the same approved asset-root governance used by Studio designs. |
| Existing truth confirmation reused | PASS | ATTHA'S truth provider points to the existing `/api/ui/*` questionnaire/confirmation/production endpoints; no parallel fact system. |
| Truth-provider dispatch | PASS | Client truth-provider registry exposes bootstrap/prepare/confirm/upload/produce endpoints and requires explicit confirmation + immutable snapshots. Unknown clients fail closed. |
| Immutable task truth remains authoritative | PASS | Design imports and Studio QA/edit routes bind back to campaign trace task snapshot. |
| First-class Creative Orchestrator | PASS | `/api/studio/orchestrate` creates an immutable `CreativeOrchestrationPlan` only after the CreativeBrief is bound to an explicitly confirmed task snapshot and before governed production begins. |
| Orchestrator specialist responsibilities | PASS | The plan explicitly coordinates `COPY_CONTENT`, `ASSET_DIRECTION` and `LAYOUT_ART_DIRECTION`, all dependent on confirmed truth + brand context + creative strategy; independent responsibilities are marked parallelizable without creating fake agent processes. |
| Orchestration production guards | PASS | Plan requires confirmed truth only, native typography, approved-source logos, deterministic layout, generated/verified visual provenance separation and Creative Director review. Guards cannot be disabled in a valid plan. |
| Orchestration project provenance | PASS | Completed Studio generation links the immutable orchestration plan to the created design using campaign, CreativeBrief, truth snapshot, client and brand bindings. Conflicting provenance is rejected. |
| Orchestration execution audit | PASS | `/api/studio/orchestration/complete` derives specialist outputs, provider/model evidence, Creative Director status, QA stages, renderer evidence and media provenance from the existing governed AI trace + final DesignDocument. Execution records are immutable and queryable. |
| Orchestrator cost discipline | PASS | Creating the plan and extracting its execution audit add exactly `0` model calls; existing strategist/finalizer/image/director calls are reused and attributed rather than duplicated. |
| Existing campaign generation reused | PASS | Studio uses the registered ATTHA'S provider's existing production route; no competing generation pipeline. |
| Existing Creative Director reused | PASS | Existing campaign Creative Director remains; layered review extends it after assembly. |
| Canonical renderer-neutral DesignDocument | PASS | `src/designDocument/*`; no canvas-library types in core document. |
| Client profile boundary | PASS | Brand tokens, fonts, QA governance, approved asset root/logo metadata and default brand kit resolve through client profiles. |
| Client layout-provider boundary | PASS | Layout selection, adaptation, geometry semantics and A/B/C direction recipes resolve through the registered client layout provider. |
| Layout-id-agnostic geometry | PASS | Shared resolver consumes `STANDARD_HERO`, `EDITORIAL_OFFCENTER` or `VERTICAL_STORY`; no ATTHA'S layout-name substring checks remain in shared geometry. |
| Layered native typography | PASS | Headline/supporting/CTA/price are native text layers. |
| Approved logo as separate layer | PASS WITH ASSET LIMIT | Approved A/fork working master is enforced. Full official Burger/Restaurant lockups are still pending source assets in the brand manifest. |
| Governed asset-root isolation | PASS | Approved-brand assets must resolve inside the active client's declared approved asset root; runtime assets remain confined to Creative OS storage. |
| Layered canvas MVP | PASS | `/studio` native SVG adapter supports selection, drag, safe guides and deterministic edits. |
| Manual editing costs zero model calls | PASS | Geometry/text styling/visibility/order/duplicate/delete operations are deterministic document mutations. |
| Undo / redo | PASS | Persistent version snapshots + cursor. |
| Arbitrary version compare | PASS | `/api/studio/compare` returns layer/property deltas. |
| Restore old version without destroying history | PASS | `/api/studio/restore` restores content as a new revision. |
| Scoped AI text editing | PASS | Only selected text layer changes; price/invented numeric claims are protected. |
| Scoped AI image/background editing | PASS | Only isolated selected media layer changes; verified product imagery and unsegmented composites are protected. |
| Subject segmentation / product separation | PASS WITH CALIBRATION GATE | Gemini polygon segmentation preserves original foreground pixels in an SVG cutout; only hidden background plate is generatively repaired. Requires empirical product-photo calibration before default automatic use. |
| Multiple design directions | PASS | Three provider-owned deterministic A/B/C composition directions are persisted and previewed side-by-side without extra creative-generation calls. |
| Deterministic design QA | PASS | Checks structure, logo, fonts, colors, safe areas, collisions, text overflow, price truth and branch availability using client profile governance. |
| Low-risk auto-polish | PASS | Deterministic corrections for safe margins, minimum logo size, approved fonts and overflow risk; no copy/price/product mutation. |
| Layered Creative Director review | PASS | Structured hierarchy/composition/brand/readability/product/CTA review persisted per design. |
| Flattened final visual QA | PASS | Final DesignDocument PNG is reviewed by the existing FinalArt QA provider after deterministic blockers are cleared. Result is persisted against the exact design version. |
| Version-bound human approval | PASS | `/api/studio/approve-version` requires current-version final visual QA `PASS`; approval records design version, approver and timestamp. |
| Stale approval rejection | PASS | Any later edit produces a new DesignDocument version; old QA/approval records remain auditable but cannot authorize the new version. |
| Approved production PNG export | PASS | `/api/studio/export-approved` reruns deterministic QA and requires current-version visual PASS + explicit approval before rendering standard/2×/4× PNG. |
| Approved asset campaign handoff | PASS | `/api/studio/register-approved-asset` registers the latest approved Studio PNG as an existing campaign asset + revision, with design/version/approver/QA provenance. Registration is idempotent. |
| Campaign lifecycle role preservation | PASS | Studio asset handoff does not move `DRAFT`, `INTERNAL_REVIEW`, `CLIENT_REVIEW`, `APPROVED` or later states. Existing workflow remains the only authority for lifecycle transitions. |
| Initial renderer migration parity | PASS | Version 1 can be compared against governed creative/format/layout/native copy/font/logo contract. |
| PNG export | PASS | Standard, 2× high-resolution and 4× artboard scale. Draft export remains available separately from approved production export. |
| SVG export | PASS | Standalone source-preserving SVG export. |
| Rect / ellipse mask rendering | PASS | HTML/PNG and SVG render paths support rotated rect/ellipse masks. Multiple visible masks targeting the same layer are rejected explicitly. |
| Multi-format adaptation | PASS | 1:1, 4:5 and 9:16 recomposition creates new DesignDocuments rather than stretching. |
| Cost controls | PASS | Manual edits are free; image generation/editing and segmentation background repair use existing paid-media gates/spend tracking. |
| Existing campaign lifecycle retained | PASS | Existing campaign store/workflow, approval and publication infrastructure remain available. |
| Second live client | NOT ENABLED | Shared provider boundaries exist, but only ATTHA'S currently has authoritative truth/task-intent data and a production implementation. No unsafe fallback is allowed. |
| JPG export | DEFERRED | No stable dependency-free JPEG encoder is present. PNG/SVG remain supported instead of adding a fragile native dependency only for conversion. |
| Full official logo lockups | EXTERNAL BLOCKER | Repository manifest still lists full Burger/Restaurant vector lockups as pending owner-supplied assets. They must not be recreated with AI/substitute fonts. |
| Konva-specific adapter | OPTIONAL / DEFERRED | Native SVG already satisfies Stage 1 interactions. `DesignDocument` remains compatible with a future Konva adapter if richer multi-select/transform UX requires it. |

## Required safety invariants

Stage 1 is not accepted if any of the following regress:

1. Campaign creative production must still pass through task truth confirmation.
2. Client truth-provider selection must never fall back silently to another client's provider or facts.
3. Brief-driven Studio production must create a persisted Creative Orchestration Plan after truth confirmation and before calling the production route.
4. The orchestration plan must remain bound to the exact campaign, CreativeBrief, confirmed task snapshot, client and brand used for the resulting design.
5. Orchestration planning/audit must not add duplicate strategist, copy, image or layout model calls merely to simulate multi-agent architecture.
6. AI must not invent or silently overwrite price, offer, branch, contact, campaign date or product facts.
7. Generated media must never be reclassified as a verified product visual.
8. Verified product foreground pixels must remain protected after segmentation.
9. Logos must originate from approved source-controlled assets inside the active client's approved asset root, including Brand Kit preview assets.
10. Promotional typography must remain native/editable rather than baked into image generation.
11. Manual geometry/styling/history operations must not invoke a model.
12. AI image operations must target a single isolated layer.
13. Deterministic blockers must be resolved before final visual QA or production approval.
14. Production approval must be bound to the exact DesignDocument version that passed final visual QA.
15. Any later edit must require a fresh final visual QA and explicit approval before approved export.
16. Registering an approved Studio asset must not impersonate a client/admin lifecycle approval or automatically change campaign state.
17. Restoring a version must create a new revision rather than erasing history.

## Governed Studio creation state machine

```text
Structured CreativeBrief
→ registered client truth provider
→ questionnaire preparation
→ explicit user confirmation
→ immutable task truth snapshot
→ persisted CreativeOrchestrationPlan
→ existing governed campaign production
→ DesignDocument assembly
→ orchestration plan linked to design provenance
→ immutable orchestration execution audit extracted from existing AI trace
→ editable Studio
```

The orchestrator does not create a duplicate copywriter/image/layout generation pipeline. It coordinates and records the responsibilities already performed by governed production, while deterministic layout/rendering remain deterministic software.

## Production export and campaign handoff state machine

```text
Editable DesignDocument vN
→ deterministic QA (PASS or WARN; BLOCK stops)
→ flattened final visual QA (must PASS)
→ explicit human approval for vN
→ approved PNG export for vN
→ optional registration as campaign asset/revision
→ existing campaign review/approval lifecycle continues unchanged
```

A change after approval creates `vN+1`. The approval for `vN` remains in governance history but is not eligible for `vN+1`.

## Client truth state machine

```text
selected client/brand
→ registered Brand Kit preview
→ registered truth provider
→ questionnaire preparation
→ explicit user confirmation
→ immutable task snapshot
→ Creative Orchestrator
→ governed creative/production
```

A client without a registered authoritative truth implementation is not production-enabled.

## CI acceptance gate

The repository's existing pull-request workflow executes:

```bash
npm ci
npm run check
```

where `npm run check` runs strict TypeScript type checking and the complete Node test suite.

Because branch pushes alone do not trigger this workflow, draft PR #51 is intentionally retained only to execute this CI gate. It must remain draft and unmerged.

## Stage 1 definition of done

Stage 1 is functionally complete when the latest `layered-architecture` head is green in CI and the acceptance items above remain satisfied. The known non-code/deferred items are JPG conversion, owner-supplied full official logo lockups and activation of a second client's authoritative truth implementation; none should be solved by weakening the current architecture.
