# Creative Studio Client Profile Boundary

The layered Creative Studio is being prepared for future multi-client use without weakening the current ATTHA'S-specific truth and campaign systems.

## Current status

ATTHA'S (`T001`) remains the only active Creative Client Profile and layout provider. No second client is enabled by this change.

The profile registry now owns presentation-level brand decisions that previously lived directly in shared Studio modules:

- client display name
- brand display names
- default brand-kit identifier
- approved asset root
- display/body/price typography
- artboard background token
- primary and secondary text tokens
- CTA fill/text tokens
- default price style
- semantic price color themes
- logo layer display name
- deterministic QA approved color set
- deterministic QA approved font set
- safe-area ratio
- minimum logo size
- whether a logo is mandatory and its requirement label

`src/creativeStudio/designDocumentAssembler.ts`, `src/creativeStudio/designQa.ts` and `src/creativeStudio/autoPolish.ts` resolve these values through the registry rather than importing ATTHA'S tokens directly.

The layout-provider registry owns layout-family selection and cross-format layout adaptation:

- list layouts for a client/brand
- resolve a layout by id
- select a governed layout from creative + production format
- choose the corresponding layout family for 1:1, 4:5 and 9:16 adaptation

`src/commands/adaptCreativeDesign.ts` asks the active client layout provider for the target layout and the client brand profile for the target artboard styling. It no longer contains ATTHA'S Burger/Restaurant layout-family branching or ATTHA'S color-token branching.

Approved-brand asset serving also resolves through the client profile. `src/dashboard/creativeStudioAssetServing.ts` serves `/studio-asset/...` before the legacy Studio handler and asks `assetPathGovernance.ts` to validate `approved-brand` paths against the loaded DesignDocument's `clientId` profile. Runtime assets remain confined to `.atthas-os` storage.

## Why this boundary exists

The Creative Studio core should eventually support another client without duplicating:

- DesignDocument
- persistence/versioning
- deterministic editing
- layer-scoped AI operations
- deterministic brand/layout QA
- safe deterministic auto-polish
- QA history
- approval/export governance
- governed asset serving
- campaign handoff mechanics
- multi-format adaptation orchestration

Client-specific facts, layouts, brand rules and assets remain separate concerns. This profile boundary does **not** claim that the complete ATTHA'S truth or canvas geometry systems are already generic.

## Active profile and layout provider

```text
T001 — ATTHA'S
├── ATTHAS_BURGER
│   └── 5 governed layout families
└── ATTHAS_RESTAURANT
    └── 5 governed layout families
```

`GET /api/studio/bootstrap` publishes the active client/brand profile metadata and per-brand layout count so a future UI can populate selectors from registries rather than hard-coded constants.

## Registration rule for future clients

A future client must not be added by cloning the ATTHA'S folder and changing names. Before activation it needs:

1. an authoritative truth source and task-truth mapping;
2. explicit brand tokens and approved asset roots;
3. typography, logo and deterministic QA governance;
4. a registered layout provider with compatible layout families;
5. product-visual truth/provenance rules;
6. client-appropriate QA rules and auto-polish thresholds;
7. tests proving no cross-client asset, truth or brand-token leakage.

Until those requirements exist, both registries should expose only ATTHA'S.

## Parity corrections made with this boundary

The assembler now also:

- omits the supporting-copy layer when supporting copy is blank instead of creating invalid whitespace text;
- uses the profile's default semantic price style when the creative does not specify one;
- therefore matches the existing M3 behavior: ATTHA'S Burger defaults to `BRAND_YELLOW`, while ATTHA'S Restaurant defaults to `BRAND_RED`.

The adaptation command preserves the existing ATTHA'S mapping through the provider:

- Burger promotional/offer/minimal families remain in-family for square/portrait and move to Burger Story Vertical for 9:16;
- Restaurant editorial/multi-dish/food-hero families remain in-family for square/portrait and move to Restaurant Story Vertical for 9:16.

The QA/auto-polish profile preserves the existing ATTHA'S deterministic rules:

- 5% safe area;
- 32px minimum digital logo size;
- current ATTHA'S token color set;
- current display/body/price font set;
- mandatory approved logo layer.

The asset-serving boundary preserves the security model while removing the path literal from the active route:

- `approved-brand` assets must resolve inside the active client's declared `approvedAssetRoot`;
- generated/uploaded/runtime assets must resolve inside Creative OS runtime storage;
- path traversal and cross-client/root paths are rejected.

## Remaining portability seams

The next client-neutral boundaries should address:

1. campaign-to-Studio opening/logo resolution, which still knows ATTHA'S source assets;
2. the base Studio intake UI, which intentionally remains ATTHA'S-only while T001 is the only active profile;
3. deterministic geometry semantics in `layoutEngine/resolver.ts`, which currently recognizes ATTHA'S-style layout id concepts such as Story Vertical, Minimal Premium and Editorial;
4. task-truth retrieval and branch/product facts, which intentionally remain ATTHA'S-specific until another client's source-of-truth system exists.
