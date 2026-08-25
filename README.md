# AI Creative OS

AI creative and marketing operating system for campaign strategy, truth-gated content generation, brand governance, visual QA and Gemini media workflows.

## Current scope — ATTHA’S first

**ATTHA’S is the only active V1 client scope.** The architecture remains extensible for future businesses, but SKK, Lifeline, public SaaS and generalized tenant workflows are deliberately postponed until ATTHA’S can reliably produce publishable campaigns with minimal manual correction.

Active brand structure:

- **T001 — ATTHA’S**
  - **ATTHA’S Restaurant** — Wellawatte / Colombo 06
  - **ATTHA’S Burger** — Wellampitiya
  - **ATTHA’S Burger** — Bambalapitiya / Colombo 04
  - **ATTHA’S Burger** — Kollupitiya / Hey Marine / Colombo 03

The system combines deterministic truth, brand, claim, format and spend controls with direct Google Gemini generation for text, images, speech and Veo video.

## Golden principle

> **Facts are retrieved. Rules are enforced. Creativity is generated. Quality is reviewed. Humans decide only when judgment or risk requires them.**

## ATTHA’S truth policy

Customer-facing facts must stay scoped to their evidence:

`brand → branch → product → sales channel → observed/effective date → source → verification status`

Public delivery-platform prices are not universal ATTHA’S prices. Offers are time-sensitive. Conflicted or missing facts are blocked. AI-generated food imagery is never evidence of actual ATTHA’S product appearance.

## ATTHA’S brand system

The working brand system lives under `clients/T001-atthas/brands/brand-system/` and includes:

- approved working palette and usage ratios
- typography direction
- logo rules
- master / Restaurant / Burger architecture
- tone of voice and CTA rules
- food photography rules
- layout/spacing/social zones
- AI visual consistency controls
- release/governance checklist
- machine-readable `tokens.json`

Design direction is approved as a working system. Final wordmark/Restaurant/Burger vector lockups, font licensing, multilingual typefaces and some brand decisions remain pending.

The owner-supplied A/fork symbol is source-controlled at:

`clients/T001-atthas/assets/logos/source/atthas-master-symbol-a-fork.svg`

The full wordmark must use approved artwork; Creative OS must never recreate the logo through an image model or substitute font.

## Visual truth classes

Creative OS distinguishes:

- `VERIFIED_PRODUCT_VISUAL`
- `CONSTRAINED_PRODUCT_GENERATION`
- `GENERIC_CONCEPT_VISUAL`

Generic AI food concepts cannot automatically become final product advertisements. Final product imagery requires valid scope, rights, product/reference truth and visual QA.

## Gemini model policy

Creative OS uses **Google Gemini only**. Active roles are centralized in `src/providers/geminiModels.ts` and `config/providers.json`:

- routine/bulk: `gemini-3.5-flash-lite`
- creative director: `gemini-3.6-flash`
- advanced / visual QA: `gemini-3.7-flash`
- deep/sensitive review: `gemini-3.1-pro-preview`
- draft image: `gemini-3.1-flash-lite-image`
- production image: `gemini-3.1-flash-image`
- premium image: `gemini-3-pro-image`
- TTS: `gemini-3.1-flash-tts-preview`
- video: Veo 3.1 Lite / Fast / Premium

Paid media remains **runtime opt-in**. `ALLOW_PAID_MEDIA=true` must be set by a command intentionally allowed to spend on generation.

## Repository

```text
ai-creative-os/
├── clients/T001-atthas/       ATTHA’S truth, brands and asset metadata
├── config/                    Gemini model-role configuration
├── docs/                      Architecture and ATTHA’S V1 roadmap
├── prompts/                   Versioned operating prompts
├── schemas/                   Machine-readable contracts
├── scripts/                   Local demos and verification utilities
├── src/                       Orchestration, governance, media and visual QA
├── tests/                     Automated and acceptance tests
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

## Safety rule for this public repository

This repository is public. **Do not commit API keys, credentials, private client material, unpublished commercial information, private customer/staff data, or private copyrighted assets.** Public source snapshots and owner-approved public-safe brand assets may be represented with provenance and scope.

## Quick start

```bash
npm install
cp .env.example .env
npm run check
```

## Deterministic campaign preflight

```bash
npm run campaign:demo
```

This demonstrates truth resolution and fact gating without calling Gemini.

## Gemini campaign demo

```bash
export GEMINI_API_KEY="..."
export GEMINI_CAMPAIGN_MODEL="gemini-3.5-flash-lite"
npm run campaign:ai-demo
```

Gemini is called only after preflight passes. Generated JSON must pass deterministic structure, price, format, claim and brand validation before Creative OS accepts it.

## Paid Gemini poster demo

Use a local image without spending:

```bash
export POSTER_BASE_IMAGE_PATH="/absolute/path/to/base-image.jpg"
npm run poster:demo
```

Or intentionally allow a Nano Banana 2 Lite draft image call:

```bash
unset POSTER_BASE_IMAGE_PATH
export ALLOW_PAID_MEDIA=true
export GEMINI_IMAGE_RESOLUTION=1K
npm run poster:demo
```

Generated base imagery contains no promotional copy or logo. Verified headline/price/CTA content is added through deterministic rendering. Raw image base64 is not written into the manifest.

## Current milestone

The technical Gemini stack is mature. Current work is deliberately focused on the higher-value ATTHA’S gaps: authoritative owner/POS/merchant truth, approved product-photo/rights mapping, final logo lockups, visual QA integration and professional ATTHA’S static-layout families.

See [`docs/ATTHAS_V1_FOUNDATION.md`](docs/ATTHAS_V1_FOUNDATION.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).
