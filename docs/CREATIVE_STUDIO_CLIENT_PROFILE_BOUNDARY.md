# Creative Studio Client Profile Boundary

The layered Creative Studio is being prepared for future multi-client use without weakening the current ATTHA'S-specific truth and campaign systems.

## Current status

ATTHA'S (`T001`) remains the only active Creative Client Profile, layout provider and truth-provider implementation. No second client is enabled by this work.

The profile registry owns presentation-level brand decisions that previously lived directly in shared Studio modules:

- client and brand display names
- default brand-kit identifier
- approved asset root and approved logo metadata
- display/body/price typography
- artboard, copy, CTA and price-theme tokens
- deterministic QA approved colors/fonts
- safe-area ratio and minimum logo size
- whether a logo is mandatory

`designDocumentAssembler.ts`, `designQa.ts` and `autoPolish.ts` resolve these values through the registry rather than importing ATTHA'S tokens directly.

## Layout-provider boundary

The layout-provider registry owns client-specific layout decisions:

- list/resolve layouts
- select a governed layout from creative + production format
- declare shared geometry semantics (`STANDARD_HERO`, `EDITORIAL_OFFCENTER`, `VERTICAL_STORY`)
- choose the corresponding 1:1, 4:5 and 9:16 adaptation family
- provide deterministic A/B/C design-direction recipes

`src/layoutEngine/resolver.ts` is client/layout-id agnostic. It no longer recognizes ATTHA'S words such as `STORY_VERTICAL`, `MINIMAL_PREMIUM` or `EDITORIAL` inside layout ids.

`adaptCreativeDesign.ts` and `generateDesignDirections.ts` consume provider-owned layout definitions and geometry semantics. The shared commands no longer contain ATTHA'S Burger/Restaurant layout-family branching.

ATTHA'S maps all ten governed layouts and its A/B/C composition recipes inside `src/creativeStudio/layoutProfiles/atthas.ts`.

## Truth-provider boundary

The Creative Studio truth flow now dispatches through a registered provider descriptor:

```text
client/brand selection
→ registered client truth provider
→ truth bootstrap
→ task questionnaire
→ explicit user confirmation
→ immutable task snapshot
→ governed production
```

The ATTHA'S provider is `ATTHAS_UI_TRUTH_V1` and deliberately points to the existing hard-gated endpoints:

- `/api/ui/bootstrap`
- `/api/ui/prepare`
- `/api/ui/confirm`
- `/api/ui/upload`
- `/api/ui/produce`

No parallel fact system was introduced. `confirmationRequired`, `immutableSnapshotRequired` and `QUESTIONNAIRE_CONFIRMATION` are explicit provider invariants.

`GET /api/studio/bootstrap` publishes the selected client's truth-provider metadata. The active Studio reads bootstrap/prepare/confirm/upload/produce endpoints from the selected profile rather than embedding those endpoint paths in the workflow code. Changing the selected brand reloads that provider's truth bootstrap.

## Campaign import and asset boundary

Campaign-to-Studio import resolves through registries. `openCreativeStudioDesign.ts`:

1. reads the governed brand id from renderer/task truth;
2. discovers the owning client profile;
3. resolves that client's layout provider;
4. selects the traced/preferred layout through that provider;
5. uses the profile's default brand-kit id;
6. resolves the approved logo from the brand profile's asset metadata.

Approved-brand asset serving validates each asset against the loaded DesignDocument's client profile. `approved-brand` assets must stay inside that profile's approved asset root; runtime assets remain confined to Creative OS runtime storage.

## Profile-driven intake

The active `/studio` Creative Brief is profile-driven. Source-controlled ATTHA'S options remain as a safe initial fallback, then `creativeStudioProfiledHtml.ts` enriches the selector from `/api/studio/bootstrap`.

`CreativeBrief.clientId`, `brandKitId` and truth-provider routing are read from selected profile metadata rather than fixed T001 request constants.

## Why this boundary exists

A future client should reuse the shared Studio core rather than duplicate:

- DesignDocument
- persistence/versioning
- deterministic editing
- scoped AI layer operations
- deterministic QA/auto-polish
- shared geometry resolution
- design-direction orchestration
- governed campaign-to-design import
- asset serving
- approval/export governance
- campaign handoff
- multi-format adaptation
- structured intake shell
- hard fact-gate UX

Client-specific facts, brand rules, assets, layouts and truth retrieval remain provider concerns.

## Active providers

```text
T001 — ATTHA'S
├── ATTHAS_BURGER
│   └── 5 governed layout families
├── ATTHAS_RESTAURANT
│   └── 5 governed layout families
└── ATTHAS_UI_TRUTH_V1
    └── existing questionnaire → confirmation → immutable snapshot flow
```

## Registration rule for future clients

A future client must not be activated by cloning ATTHA'S and changing names. It needs:

1. an authoritative truth source and client truth-provider implementation;
2. explicit brand tokens, approved asset roots and approved logo metadata;
3. typography, logo and deterministic QA governance;
4. a registered layout provider with geometry/adaptation/direction semantics;
5. product-visual truth/provenance rules;
6. tests proving no cross-client asset, truth, brand-token or provider leakage.

Unknown clients fail closed: there is no fallback to ATTHA'S profile, layout or truth providers.

## Parity guarantees

The abstraction work preserves current ATTHA'S behavior:

- blank supporting copy is omitted rather than emitted as invalid whitespace;
- Burger defaults to `BRAND_YELLOW` pricing and Restaurant to `BRAND_RED`;
- existing square/portrait/story adaptation behavior is unchanged;
- existing A/B/C direction names, layouts, copy zones and price-aware Burger direction remain unchanged;
- 5% QA safe area and 32px minimum digital logo size remain unchanged;
- ATTHA'S approved colors/fonts remain authoritative;
- approved logo remains mandatory;
- task facts still require explicit confirmation before production;
- confirmed facts still become the immutable snapshot used by downstream generation.

## Remaining multi-client blocker

The shared dispatch contracts now exist, but **only ATTHA'S has a real authoritative truth dataset, task-intent mapping, branch/product facts and production implementation registered behind them**.

That is intentional. A second client should be enabled only after its source-of-truth implementation can satisfy the same confirmation and immutable-snapshot guarantees. The architecture must not simulate multi-client support by falling back to ATTHA'S data or by allowing creative generation before truth confirmation.
