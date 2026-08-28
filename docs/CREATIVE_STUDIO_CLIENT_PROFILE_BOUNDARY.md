# Creative Studio Client Profile Boundary

The layered Creative Studio is being prepared for future multi-client use without weakening the current ATTHA'S-specific truth and campaign systems.

## Current status

ATTHA'S (`T001`) remains the only active Creative Client Profile and layout provider. No second client is enabled by this work.

The profile registry now owns presentation-level brand decisions that previously lived directly in shared Studio modules:

- client display name
- brand display names
- default brand-kit identifier
- approved asset root
- per-brand approved logo asset metadata
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

The layout-provider registry owns layout-family selection, geometry semantics and cross-format layout adaptation:

- list layouts for a client/brand
- resolve a layout by id
- select a governed layout from creative + production format
- declare one of the shared geometry profiles (`STANDARD_HERO`, `EDITORIAL_OFFCENTER`, `VERTICAL_STORY`)
- choose the corresponding layout family for 1:1, 4:5 and 9:16 adaptation

`src/layoutEngine/resolver.ts` is now client/layout-id agnostic. It consumes an explicit geometry profile instead of recognizing ATTHA'S words such as `STORY_VERTICAL`, `MINIMAL_PREMIUM` or `EDITORIAL` inside layout ids. ATTHA'S maps all ten governed layouts to explicit geometry/adaptation semantics inside its own provider.

`src/commands/adaptCreativeDesign.ts` asks the active client layout provider for both the target layout and its geometry profile, and asks the client brand profile for target artboard styling. It contains no ATTHA'S Burger/Restaurant layout-family or color-token branching.

Campaign-to-Studio import also resolves through the registries. `openCreativeStudioDesign.ts` now:

1. reads the governed brand id from renderer/task truth;
2. discovers the owning client profile;
3. resolves that client's layout provider;
4. selects the traced/preferred layout through that provider;
5. uses the profile's default brand-kit id;
6. resolves the approved logo from the brand profile's asset metadata.

The DesignDocument assembly bridge uses generic string brand ids and generic `CreativeLayoutDefinition` instead of ATTHA'S-specific TypeScript unions.

Approved-brand asset serving also resolves through the client profile. `src/dashboard/creativeStudioAssetServing.ts` serves `/studio-asset/...` before the legacy Studio handler and asks `assetPathGovernance.ts` to validate `approved-brand` paths against the loaded DesignDocument's `clientId` profile. Runtime assets remain confined to `.atthas-os` storage.

The active `/studio` intake is profile-driven as well. The source-controlled ATTHA'S options remain as a safe initial fallback, then `creativeStudioProfiledHtml.ts` enriches the brand selector from `GET /api/studio/bootstrap`. `CreativeBrief.clientId` and `brandKitId` are read from the selected profile/brand metadata rather than fixed T001 request constants.

## Why this boundary exists

The Creative Studio core should eventually support another client without duplicating:

- DesignDocument
- persistence/versioning
- deterministic editing
- layer-scoped AI operations
- deterministic brand/layout QA
- safe deterministic auto-polish
- governed campaign-to-design import
- shared geometry resolution
- QA history
- approval/export governance
- governed asset serving
- campaign handoff mechanics
- multi-format adaptation orchestration
- structured Creative Brief intake shell

Client-specific facts, layouts, brand rules and assets remain separate concerns.

## Active profile and layout provider

```text
T001 — ATTHA'S
├── ATTHAS_BURGER
│   └── 5 governed layout families
└── ATTHAS_RESTAURANT
    └── 5 governed layout families
```

`GET /api/studio/bootstrap` publishes active client/brand metadata and per-brand layout availability so the Studio UI can populate selectors from registries rather than hard-coded request values.

## Registration rule for future clients

A future client must not be added by cloning the ATTHA'S folder and changing names. Before activation it needs:

1. an authoritative truth source and task-truth mapping;
2. explicit brand tokens, approved asset roots and approved logo metadata;
3. typography, logo and deterministic QA governance;
4. a registered layout provider with explicit geometry/adaptation semantics;
5. product-visual truth/provenance rules;
6. client-appropriate QA rules and auto-polish thresholds;
7. tests proving no cross-client asset, truth or brand-token leakage.

Until those requirements exist, both registries should expose only ATTHA'S.

## Parity guarantees

The abstraction work preserves existing ATTHA'S behavior:

- blank supporting copy is omitted rather than emitted as invalid whitespace text;
- Burger defaults to `BRAND_YELLOW` pricing and Restaurant defaults to `BRAND_RED`, matching M3;
- Burger promotional/offer/minimal families remain in-family for square/portrait and use Burger Story Vertical for 9:16;
- Restaurant editorial/multi-dish/food-hero families remain in-family for square/portrait and use Restaurant Story Vertical for 9:16;
- Story layouts adapted back to square/portrait preserve the previous fallback behavior (Burger Hero / Restaurant Hospitality);
- 5% QA safe area remains unchanged;
- 32px minimum digital logo size remains unchanged;
- the current ATTHA'S token color and font sets remain authoritative;
- the approved logo remains mandatory;
- approved-brand assets remain confined to the profile's approved asset root.

## Remaining portability seam

The principal remaining client-specific boundary is **task-truth preparation and branch/product fact retrieval**. The current `/api/ui/prepare` and `/api/ui/confirm` flow is intentionally ATTHA'S-specific because no second client's source-of-truth system exists yet.

The correct next abstraction is a truth-provider contract that preserves the current hard fact gate:

```text
client/brand selection
→ client truth provider
→ task questionnaire
→ explicit user confirmation
→ immutable task snapshot
→ creative orchestration
```

A second client must not be activated until its truth provider can satisfy that contract without bypassing fact confirmation.
