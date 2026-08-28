# Creative Studio Client Profile Boundary

The layered Creative Studio is being prepared for future multi-client use without weakening the current ATTHA'S-specific truth and campaign systems.

## Current status

ATTHA'S (`T001`) remains the only active Creative Client Profile and layout provider. No second client is enabled by this change.

The profile registry now owns presentation-level brand decisions that previously lived directly in the DesignDocument assembler:

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

`src/creativeStudio/designDocumentAssembler.ts` resolves these values through the registry rather than importing ATTHA'S tokens directly.

The layout-provider registry now owns layout-family selection and cross-format layout adaptation:

- list layouts for a client/brand
- resolve a layout by id
- select a governed layout from creative + production format
- choose the corresponding layout family for 1:1, 4:5 and 9:16 adaptation

`src/commands/adaptCreativeDesign.ts` now asks the active client layout provider for the target layout and asks the client brand profile for the target artboard styling. It no longer contains ATTHA'S Burger/Restaurant layout-family branching or ATTHA'S color-token branching.

## Why this boundary exists

The Creative Studio core should eventually support another client without duplicating:

- DesignDocument
- persistence/versioning
- deterministic editing
- layer-scoped AI operations
- QA history
- approval/export governance
- campaign handoff mechanics
- multi-format adaptation orchestration

Client-specific facts, layouts, brand rules and assets remain separate concerns. This profile boundary does **not** claim that the complete ATTHA'S truth, QA, asset resolution or canvas geometry systems are already generic.

## Active profile and layout provider

```text
T001 — ATTHA'S
├── ATTHAS_BURGER
│   └── 5 governed layout families
└── ATTHAS_RESTAURANT
    └── 5 governed layout families
```

`GET /api/studio/bootstrap` publishes the active client/brand profile metadata so a future UI can populate selectors from the registry rather than hard-coded constants.

## Registration rule for future clients

A future client must not be added by cloning the ATTHA'S folder and changing names. Before activation it needs:

1. an authoritative truth source and task-truth mapping;
2. explicit brand tokens and approved asset roots;
3. typography and logo governance;
4. a registered layout provider with compatible layout families;
5. product-visual truth/provenance rules;
6. QA rules appropriate to that client's brand;
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

## Remaining portability seams

The next client-neutral boundaries should address:

1. deterministic QA and auto-polish, which still use ATTHA'S brand tokens/rules directly;
2. approved-brand asset path resolution, which still assumes the ATTHA'S source asset directory in the Studio serving route;
3. campaign-to-Studio opening/logo resolution, which still knows ATTHA'S source assets;
4. the base Studio intake UI, which intentionally remains ATTHA'S-only while T001 is the only active profile;
5. deterministic geometry semantics in `layoutEngine/resolver.ts`, which currently recognizes ATTHA'S-style layout id concepts such as Story Vertical, Minimal Premium and Editorial.
