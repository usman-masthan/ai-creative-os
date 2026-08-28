# Creative Studio Client Profile Boundary

The layered Creative Studio is being prepared for future multi-client use without weakening the current ATTHA'S-specific truth and campaign systems.

## Current status

ATTHA'S (`T001`) remains the only active Creative Client Profile. No second client is enabled by this change.

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

## Why this boundary exists

The Creative Studio core should eventually support another client without duplicating:

- DesignDocument
- persistence/versioning
- deterministic editing
- layer-scoped AI operations
- QA history
- approval/export governance
- campaign handoff mechanics

Client-specific facts, layouts, brand rules and assets remain separate concerns. This profile boundary does **not** claim that ATTHA'S layouts or truth sources are already generic.

## Active profile

```text
T001 — ATTHA'S
├── ATTHAS_BURGER
└── ATTHAS_RESTAURANT
```

`GET /api/studio/bootstrap` publishes the active profile metadata so a future UI can populate client/brand selectors from the registry rather than hard-coded constants.

## Registration rule for future clients

A future client must not be added by cloning the ATTHA'S folder and changing names. Before activation it needs:

1. an authoritative truth source and task-truth mapping;
2. explicit brand tokens and approved asset roots;
3. typography and logo governance;
4. layout-family definitions or a client-neutral layout adapter;
5. product-visual truth/provenance rules;
6. QA rules appropriate to that client's brand;
7. tests proving no cross-client asset, truth or brand-token leakage.

Until those requirements exist, the registry should expose only ATTHA'S.

## Parity corrections made with this boundary

The assembler now also:

- omits the supporting-copy layer when supporting copy is blank instead of creating invalid whitespace text;
- uses the profile's default semantic price style when the creative does not specify one;
- therefore matches the existing M3 behavior: ATTHA'S Burger defaults to `BRAND_YELLOW`, while ATTHA'S Restaurant defaults to `BRAND_RED`.
