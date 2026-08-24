# AI Creative OS

Multi-client AI creative and marketing operating system for campaign strategy, content generation, QA, brand governance, and AI media workflows.

## Current scope

AI Creative OS is currently an **internal three-client operating system** for:

- **T001 — ATTHA'S**
  - ATTHA'S Authentic Multi Cuisine
  - ATTHA'S Burger
- **T002 — SKK Meat Goodies**
- **T003 — Lifeline Association Sri Lanka**

The system combines deterministic tenant/truth/brand/claim controls with direct Google Gemini generation for text, images, speech and Veo video.

## Golden principle

> **Facts are retrieved. Rules are enforced. Creativity is generated. Quality is reviewed. Humans decide only when judgment or risk requires them.**

## Gemini model policy

Creative OS uses **Google Gemini only**. Active roles are centralized in `src/providers/geminiModels.ts` and `config/providers.json`:

- routine/bulk: `gemini-3.5-flash-lite`
- creative director: `gemini-3.6-flash`
- advanced Flash: `gemini-3.7-flash`
- deep/sensitive review: `gemini-3.1-pro-preview`
- draft image: `gemini-3.1-flash-lite-image`
- production image: `gemini-3.1-flash-image`
- premium image: `gemini-3-pro-image`
- TTS: `gemini-3.1-flash-tts-preview`
- video: Veo 3.1 Lite / Fast / Premium

Paid media remains **runtime opt-in** even though billing is enabled. `ALLOW_PAID_MEDIA=true` must be set by a command that is intentionally allowed to spend on media generation.

## Repository

```text
ai-creative-os/
├── clients/                 Tenant-safe brand, truth and campaign data
├── config/                  Gemini model-role configuration
├── docs/                    Architecture, security, roadmap and AI workflows
├── prompts/                 Versioned AI operating prompts
├── schemas/                 Machine-readable workflow contracts
├── scripts/                 Local demos and verification utilities
├── src/                     Orchestration, governance and Gemini providers
├── tests/                   Automated and acceptance tests
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

## Safety rule for this public repository

This repository is public. **Do not commit client secrets, private assets, unpublished prices/offers, beneficiary-identifying data, API keys, credentials, or sensitive campaign material.**

Use placeholders in Git. Store real sensitive material in approved private storage and inject it at runtime.

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

This demonstrates tenant validation, truth resolution and fact gating without calling Gemini.

## Gemini campaign demo

```bash
export GEMINI_API_KEY="..."
export GEMINI_CAMPAIGN_MODEL="gemini-3.5-flash-lite"
npm run campaign:ai-demo
```

Gemini is called only after preflight passes. Generated JSON must then pass deterministic structure, price, format, claim and brand validation before Creative OS accepts it.

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

The generated base image contains no promotional copy or factual overlays. Creative OS writes verified headline/price/CTA data through its deterministic HTML/CSS renderer.

## Cost and escalation controls

- routine text starts on Flash Lite
- stronger text models are selected by explicit roles
- production/premium image roles require an approved concept through policy guards
- Veo requires an approved static direction
- premium media requires an explicit override
- provider usage/cost telemetry is recorded when the API exposes enough information
- price estimates are advisory and versioned; Google billing remains the source of truth

## Current milestones

1. Tenant isolation — implemented.
2. Verified truth / conflict handling — implemented.
3. T001 ATTHA'S onboarding — implemented.
4. Deterministic campaign preflight — implemented.
5. Fact-gated Gemini campaign generation — implemented.
6. Direct Gemini image generation + deterministic poster production — implemented.
7. Gemini TTS and Veo production providers — implemented.
8. Usage/cost telemetry and paid-media escalation guards — implemented.
9. Persistence, automation and dashboard — later phases.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the broader implementation plan.
