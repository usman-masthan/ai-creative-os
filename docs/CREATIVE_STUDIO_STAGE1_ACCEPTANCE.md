# AI Creative Studio — Stage 1 Acceptance Matrix

This document defines the acceptance status of the `layered-architecture` branch. It is intentionally separate from `main`. The draft PR is a CI surface only and must remain unmerged until explicit approval.

## Stage 1 product goal

A user can move from a structured marketing brief to a governed creative, open it as editable layered design data, refine it manually or with scoped AI assistance, review alternatives, run QA, adapt formats, preserve history, explicitly approve an exact reviewed version, export a clean production asset, and register that asset back into the existing campaign revision history without bypassing task truth, brand governance, orchestration provenance, or campaign lifecycle roles.

## Acceptance matrix

| Capability | Status | Acceptance evidence |
| --- | --- | --- |
| Structured Creative Brief | PASS | `CreativeBrief` contract/schema + `/studio` intake UI. |
| Complete brief content requirements | PASS | Intake explicitly controls price, offer, CTA, product name, branch, contact details, campaign dates, headline direction and custom creative instructions rather than deriving them from hidden defaults. |
| Truth-aware requested content | PASS | Before production authorization, Creative Orchestrator requires matching confirmed facts for requested visible price, offer, product name, contact details and campaign dates. Missing fact support fails closed instead of permitting invented copy. |
| Complete governed output formats | PASS | One shared output-format registry drives intake and adaptation for Instagram Square/Portrait/Story, Facebook Post/Story, Digital Menu 16:9, Web Banner 21:9, Poster 3:4 and validated Custom artboards. |
| Exact custom artboard dimensions | PASS | Custom width/height are validated from 64–16384 px, reduced to an explicit aspect ratio and preserved as the final renderer/DesignDocument dimensions. |
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
| Fluid format layout semantics | PASS | Exact social ratios remain supported, while standard layouts deterministically recompose wide/poster/custom artboards and story layouts remain restricted to story-like tall artboards. |
| Layered native typography | PASS | Headline/supporting/CTA/price are native text layers. |
| Approved logo as separate layer | PASS WITH ASSET LIMIT | Approved A/fork working master is enforced. Full official Burger/Restaurant lockups are still pending source assets in the brand manifest. |
| Governed asset-root isolation | PASS | Approved-brand assets must resolve inside the active client's declared approved asset root; runtime assets remain confined to Creative OS storage. |
| Layered canvas MVP | PASS | `/studio` native SVG adapter supports selection, drag, safe guides and deterministic edits. |
| Direct canvas resize / rotate | PASS | Selected unlocked layers expose an SVG resize handle and, except protected logos, a rotation handle. Pointer-up commits the existing versioned `RESIZE_LAYER` / `ROTATE_LAYER` operation instead of mutating hidden state. |
| Keyboard canvas editing | PASS | Arrow keys nudge selected unlocked layers by 1 px, Shift+Arrow by 10 px, with safe-margin/centre snapping; Cmd/Ctrl+D and Delete reuse governed duplicate/delete operations. |
| Multi-selection | PASS | Shift/Cmd/Ctrl-click selects multiple canvas/layer-list items, renders independent selection outlines plus a shared bounds box, and suppresses conflicting single-layer transform handles. |
| Marquee selection | PASS | Dragging on blank/background canvas draws a transient selection rectangle and selects intersecting visible, unlocked editable leaf layers. Shift/Cmd/Ctrl marquee is additive; background/group/mask/locked structure is excluded. |
| Layer-to-layer smart guides | PASS | Single- and multi-object drag previews snap nearby layer left/centre/right and top/middle/bottom anchors within a deterministic tolerance and draw transient magenta guide lines. Guide state is never persisted in DesignDocument. |
| Equal-spacing guides | PASS | When a moving frame is nearly centred between nearest left/right or top/bottom neighbours, deterministic equal-gap snapping takes effect and transient spacing indicators are drawn. Pure guide math has regression coverage. |
| Multi-layer movement | PASS | Dragging any selected canvas layer or using arrow keys moves the selected set through one `MOVE_LAYERS` operation, producing one persisted revision rather than N independent edits. |
| Atomic multi-object duplicate / delete | PASS | Multi-selection Cmd/Ctrl+D, Delete/Backspace and Arrange buttons use `/api/studio/multi-object`; all selected eligible leaves duplicate/delete in one new document version, with deterministic QA rerun and stable caller-supplied duplicate ids. |
| Multi-object structure governance | PASS | Multi duplicate/delete rejects locked logos, primary background, groups and masks; grouped children cannot be multi-deleted until ungrouped. These protections are enforced server-side, not only in the UI. |
| Hierarchical Layers panel | PASS | Group containers render once as expandable/collapsible parents with child layers indented beneath them. Collapse state remains transient UI state and does not alter the DesignDocument. |
| Layer / group rename | PASS | Double-click rename uses governed `RENAME_LAYER`; display metadata changes in one persisted revision without changing layer identity, truth, asset provenance or group membership. |
| Professional z-order controls | PASS | Front/Forward/Backward/Back controls and Cmd/Ctrl bracket shortcuts use atomic `REORDER_LAYERS`; multi-selection moves as a stable block and a selected group expands to its native children for stacking. |
| Protected stacking tiers | PASS | Background, approved logo, mask, locked and group-container z-order are not rewritten by layer-order tooling. Editable layers reorder only within their existing editable z-index slots. |
| Whole-group duplication | PASS | `DUPLICATE_GROUP` creates a new group plus new native child IDs in one revision, preserves editable text/assets/shapes, applies a deterministic offset and refuses masked/protected children. |
| Truth-safe reusable component library | PASS | Selected groups can be saved as immutable client+brand-scoped reusable blocks. Version 1 persists native text style/geometry slots plus shapes only; image/logo/background/mask/nested/locked/mask-bound content is rejected. |
| Reusable component source-content stripping | PASS | Saved component JSON omits source text payloads, source layer display names and asset references. Source text roles, typography/style/geometry, source design/truth provenance and detected required truth keys remain for safe reconstruction/audit. |
| Destination truth + text rebinding | PASS | Component insertion requires the destination DesignDocument's confirmed task snapshot, exact client+brand match, every recorded truth key, and exactly one native destination text layer for each component role. Inserted text comes from the destination design, never the source campaign. |
| Component instance provenance | PASS | Inserted child/group layers carry `componentInstance` metadata (`componentId`, `instanceId`, `templateLayerId`). Insertion creates one new DesignDocument version, reruns deterministic QA and adds zero model calls. |
| Immutable component family versions | PASS | Components are organized into brand-scoped families with contiguous immutable versions. `Duplicate as New Version` creates a new immutable component definition and latest-version pointer without rewriting older versions or existing design instances. Legacy component files are lazily registered as v1 families. |
| Component lifecycle states | PASS | Family metadata supports `ACTIVE`, `DEPRECATED` and `ARCHIVED`. Deprecated/archived families remain auditable but cannot be newly inserted or versioned until reactivated; status changes never mutate existing designs. |
| Explicit component instance upgrade | PASS | Upgrade must stay inside the same active family, target a strictly newer immutable version, revalidate destination confirmed truth, rebind destination native text, preserve current instance placement/rotation as closely as possible and persist exactly one new DesignDocument revision + deterministic QA. No instance auto-updates. |
| Component instance detach | PASS | Detach removes only `componentInstance` provenance from the selected group/children in one revision; native layers, text, styling, group membership and geometry remain editable and unflattened. |
| Align / distribute | PASS | Six alignment modes plus horizontal/vertical distribution run as deterministic `ALIGN_LAYERS` / `DISTRIBUTE_LAYERS` operations. Distribution requires at least three layers. |
| Group / ungroup | PASS | `GROUP_LAYERS` creates a validated non-rendering selection container over existing child layers; `UNGROUP_LAYERS` removes only the container and preserves child content and geometry. Cmd/Ctrl+G and Shift+Cmd/Ctrl+G use the same operations. |
| Group membership integrity | PASS | A child may belong to only one group; background/logo/group/mask layers are excluded from movable group membership; missing, duplicate, nested or self-referencing group membership fails validation. |
| Group move / visibility / lock | PASS | Moving a group translates every child in one revision. Group visibility and lock actions propagate to group members instead of changing an inert metadata layer only. |
| Group proportional resize | PASS | Group resize preserves aspect ratio, scales child positions/dimensions, native text size/letter spacing/shadow metrics, and shape stroke/corner metrics in one governed revision. Non-proportional group distortion is rejected. |
| Group rotation | PASS | Group rotation rotates each child centre around the group pivot, adds the rotation delta to each child rotation, recomputes visual group bounds and remains one `ROTATE_LAYER` revision. |
| Canvas transform governance | PASS | Locked layers receive no transform controls; logos cannot rotate/duplicate/delete and backgrounds cannot delete. Grouping, marquee selection, layer management, reusable components and multi-object actions cannot bypass these protections because structural eligibility is enforced at the document/server layer. |
| Manual editing costs zero model calls | PASS | Geometry/text styling/visibility/order/rename/duplicate/delete/multi-arrange/group/marquee/smart-guide/reusable-component lifecycle operations are deterministic local/document mutations. |
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
| Multi-format adaptation | PASS | All governed fixed presets plus validated Custom dimensions are recomposed into new DesignDocuments using client layout semantics and deterministic geometry rather than stretching the source design. |
| Custom media-source ratio safety | PASS | When an arbitrary custom ratio is unsupported by the image provider, only the generated source-media request maps to the nearest supported ratio; the DesignDocument and final renderer keep the exact requested artboard. |
| Cost controls | PASS | Manual edits are free; image generation/editing and segmentation background repair use existing paid-media gates/spend tracking. |
| Existing campaign lifecycle retained | PASS | Existing campaign store/workflow, approval and publication infrastructure remain available. |
| Second live client | NOT ENABLED | Shared provider boundaries exist, but only ATTHA'S currently has authoritative truth/task-intent data and a production implementation. No unsafe fallback is allowed. |
| JPG export | DEFERRED | No stable dependency-free JPEG encoder is present. PNG/SVG remain supported instead of adding a fragile native dependency only for conversion. |
| Full official logo lockups | EXTERNAL BLOCKER | Repository manifest still lists full Burger/Restaurant vector lockups as pending owner-supplied assets. They must not be recreated with AI/substitute fonts. |
| Konva-specific adapter | OPTIONAL / DEFERRED | Native SVG now satisfies Stage 1 single/multi/marquee selection, hierarchical layer management, drag, resize, rotation, grouping, alignment, distribution, smart/equal-spacing guides, snapping and keyboard-edit interactions. `DesignDocument` remains compatible with a future canvas adapter if later UX requires richer handles or performance at much larger layer counts. |

## Required safety invariants

Stage 1 is not accepted if any of the following regress:

1. Campaign creative production must still pass through task truth confirmation.
2. Client truth-provider selection must never fall back silently to another client's provider or facts.
3. Brief-driven Studio production must create a persisted Creative Orchestration Plan after truth confirmation and before calling the production route.
4. The orchestration plan must remain bound to the exact campaign, CreativeBrief, confirmed task snapshot, client and brand used for the resulting design.
5. Orchestration planning/audit must not add duplicate strategist, copy, image or layout model calls merely to simulate multi-agent architecture.
6. AI must not invent or silently overwrite price, offer, branch, contact, campaign date or product facts.
7. A CreativeBrief requesting visible price, offer, product name, contact details or campaign dates must not receive production authorization unless matching task-confirmed truth exists.
8. Headline direction and custom instructions are creative guidance only; they never create new business truth.
9. Generated media must never be reclassified as a verified product visual.
10. Verified product foreground pixels must remain protected after segmentation.
11. Logos must originate from approved source-controlled assets inside the active client's approved asset root, including Brand Kit preview assets.
12. Promotional typography must remain native/editable rather than baked into image generation.
13. Manual geometry/styling/history operations must not invoke a model.
14. Direct canvas transforms, marquee/multi-selection, smart guides, alignment, distribution, grouping and layer-management controls must remain adapters over governed DesignDocument operations or transient selection state; they must not bypass locked-layer, logo or structural governance.
15. One user arrange/rename/reorder/duplicate/delete action must create one persisted document version rather than silently generating multiple history revisions for each selected layer.
16. Smart/equal-spacing guides and group collapse state must remain transient interaction data and must never become hidden persisted design truth or invoke a model.
17. A grouped child must belong to only one group, and protected logo/background/mask/group layers must not be admitted into a movable group as a way around their governance.
18. Group resize must remain proportional and group rotation must transform child geometry around the group pivot; neither operation may flatten text or assets into pixels.
19. Multi-object duplicate/delete must enforce logo/background/group/mask/lock protections server-side, even if a malformed client bypasses UI disabled states.
20. Layer-order tooling must never rewrite protected background/logo/mask/group-container stacking; editable selections may move only within editable z-index slots.
21. Whole-group duplication must create new native child identities and must fail closed if a child is locked/protected or participates in mask semantics that are not duplicated with it.
22. Reusable component persistence must not retain source campaign text payloads, source layer display names or asset references; only native text style/geometry slots and shapes may enter the v1 component library.
23. Reusable component insertion must remain client+brand scoped, require the destination confirmed task snapshot and every recorded truth key, and rebind each text slot from exactly one native destination role layer rather than reusing source copy.
24. Component insertion must create one new DesignDocument revision, rerun deterministic QA and retain `componentInstance` provenance on inserted layers; component save/list/insert must add zero model calls.
25. Component definitions must remain immutable. Family lifecycle/version metadata must be stored separately, and creating vN+1 must never overwrite vN or mutate existing design instances.
26. Deprecated or archived component families must not be newly inserted or versioned until explicitly reactivated; lifecycle status changes must not mutate existing designs.
27. Component upgrades must be explicit, same-family, strictly forward-version operations that revalidate destination truth and persist exactly one new DesignDocument revision; there must be no live-linked or automatic instance mutation.
28. Component detach must remove provenance only and preserve native layer content/geometry/group membership; it must not flatten, delete or invoke a model.
29. AI image operations must target a single isolated layer.
30. A custom or non-social output format must preserve the exact requested DesignDocument/render dimensions; image-provider aspect normalization may affect only generated source media.
31. Format adaptation must create a new recomposed DesignDocument and must not stretch or destructively overwrite the source design.
32. Story-layout semantics must not be forced onto a non-story artboard, and standard-fluid layout semantics must not silently masquerade as a story layout.
33. Deterministic blockers must be resolved before final visual QA or production approval.
34. Production approval must be bound to the exact DesignDocument version that passed final visual QA.
35. Any later edit must require a fresh final visual QA and explicit approval before approved export.
36. Registering an approved Studio asset must not impersonate a client/admin lifecycle approval or automatically change campaign state.
37. Restoring a version must create a new revision rather than erasing history.

## Governed Studio creation state machine

```text
Structured CreativeBrief
→ governed output-format resolution
→ registered client truth provider
→ questionnaire preparation
→ explicit user confirmation
→ immutable task truth snapshot
→ requested visible-content truth check
→ persisted CreativeOrchestrationPlan
→ existing governed campaign production at the requested format
→ DesignDocument assembly at exact artboard dimensions
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

## Format adaptation state machine

```text
Editable source DesignDocument
→ governed fixed preset or validated Custom dimensions
→ client layout-provider semantic selection
→ deterministic geometry recomposition
→ new DesignDocument with new identity/version lineage
→ QA / editing / approval continue normally
```

The source DesignDocument is never destructively resized. For custom artboards unsupported by the media provider, only generated source imagery uses a nearest supported source aspect ratio; final layout and export remain exact to the requested width and height.

## Canvas and arrange state machine

```text
Pointer selection / marquee selection / hierarchical Layers panel
→ selected unlocked layer(s) or group container
→ direct drag / smart snap / handle / keyboard / Arrange / rename / layer-order / duplicate / delete
→ local interaction preview + transient guides/collapse state only
→ one governed DesignDocument mutation when content or layer metadata changes
→ one new persisted document version
→ deterministic QA rerun
→ Studio rerender
```

For a multi-selection, `MOVE_LAYERS`, `ALIGN_LAYERS` and `DISTRIBUTE_LAYERS` update all selected leaves in one revision. Atomic multi-object duplicate/delete, rename, z-order and whole-group duplication use the same governed Studio mutation surface and create one DesignDocument version with deterministic QA rerun. `GROUP_LAYERS` creates a non-rendering selection container; moving, proportionally resizing or rotating the group transforms its existing children without flattening them. `UNGROUP_LAYERS` removes the container only.

Layer-order operations preserve protected stacking tiers. A selected group is expanded to its child leaves for visual stacking while the group container itself remains non-rendering metadata. Whole-group duplication creates new child IDs plus a new group ID; it never aliases the original group's membership or flattens its content.

Smart alignment and equal-spacing guides exist only during interaction previews. Marquee selection and group collapse/expand change UI selection/presentation state only. None creates an AI call or document version by itself.

Direct interaction is therefore only an adapter over the document operation model. Protected logos, backgrounds, masks and locked layers retain the same governance they have through the property panel and API.

## Reusable component lifecycle state machine

```text
Selected native group
→ verify unlocked text/shape-only membership
→ reject image/logo/background/mask/nested/mask-bound content
→ detect source confirmed-truth dependencies
→ strip source text payloads + source layer labels
→ persist immutable client+brand-scoped component family v1
→ ACTIVE
   ├─ duplicate selected immutable version as vN+1
   ├─ explicit insert after destination truth validation
   ├─ DEPRECATED (no new insert/version)
   └─ ARCHIVED   (no new insert/version)

Attached instance vN
→ user explicitly chooses Upgrade
→ family must be ACTIVE
→ target must be same family and newer than vN
→ resolve destination confirmed task snapshot again
→ require target truth keys + unique native destination text roles
→ rebuild target version with destination text
→ preserve current visual placement/rotation through in-memory transforms
→ replace old instance
→ persist exactly one DesignDocument revision
→ deterministic QA rerun

Attached instance
→ user chooses Detach
→ remove componentInstance provenance only
→ preserve native group + children + content + geometry
→ persist one DesignDocument revision
→ deterministic QA rerun
```

There are no live-linked master components and no automatic instance updates. Mutable lifecycle state is stored separately from immutable component definitions. Existing instances remain auditable against the exact immutable `componentId` they were created from until the user explicitly upgrades or detaches them.

## Client truth state machine

```text
selected client/brand
→ registered Brand Kit preview
→ registered truth provider
→ questionnaire preparation
→ explicit user confirmation
→ immutable task snapshot
→ requested visible-content truth check
→ Creative Orchestrator
→ governed creative/production
```

A client without a registered authoritative truth implementation is not production-enabled. If a requested optional content class is not represented in the confirmed snapshot, Studio fails closed before production rather than inventing it.

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
