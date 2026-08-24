# AI Creative OS

Multi-client AI creative and marketing operating system for campaign strategy, content generation, QA, brand governance, and AI media workflows.

## Current scope

AI Creative OS is currently an **internal three-client operating system** for:

- **T001 — ATTHA'S**
  - ATTHA'S Authentic Multi Cuisine
  - ATTHA'S Burger
- **T002 — SKK Meat Goodies**
- **T003 — Lifeline Association Sri Lanka**

Phase 1 established tenant isolation, verified-fact gates, risk handling, structured truth, brand governance and acceptance tests. Phase 2 adds Gemini-backed campaign generation behind those deterministic controls.

## Golden principle

> **Facts are retrieved. Rules are enforced. Creativity is generated. Quality is reviewed. Humans decide only when judgment or risk requires them.**

## AI provider policy

Creative OS now uses **Google Gemini only**. OpenRouter, Groq, OpenAI, getimg.ai, Anthropic and Runway are not part of the active stack.

The model roles are centralized in `src/providers/geminiModels.ts` and `config/providers.json`:

- default campaign/bulk: `gemini-3.5-flash-lite`
- creative director: `gemini-3.6-flash`
- optional latest Flash: `gemini-3.7-flash`
- paid deep review: `gemini-3.1-pro-preview`
- paid image draft: `gemini-3.1-flash-lite-image`
- paid image production: `gemini-3.1-flash-image`
- paid premium image: `gemini-3-pro-image`
- TTS: `gemini-3.1-flash-tts-preview`
- paid video: Veo 3.1 Lite / Fast / Premium

The current development phase uses the free Gemini project for text generation. Paid-only media models remain configured but disabled until billing is deliberately enabled.

## What this repository contains

```text
ai-creative-os/
├── clients/                 Tenant-safe brand, truth and campaign data
├── config/                  Gemini model-role configuration
├── docs/                    Architecture, security, roadmap and AI workflows
├── prompts/                 Versioned AI operating prompts
├── schemas/                 Machine-readable workflow contracts
├── scripts/                 Local demos and verification utilities
├── src/                     Orchestration, truth gates and Gemini provider logic
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

## Gemini AI campaign demo

Set a Gemini API key in your shell, then run:

```bash
export GEMINI_API_KEY="..."
export GEMINI_CAMPAIGN_MODEL="gemini-3.5-flash-lite"
npm run campaign:ai-demo
```

The Gemini API is called **only after campaign preflight passes**. Campaign generation requests JSON output and the deterministic validators still decide whether generated creative is accepted.

See [`docs/AI_CAMPAIGN_GENERATOR.md`](docs/AI_CAMPAIGN_GENERATOR.md) for the generation pipeline and safety boundaries.

## Poster demo during the free phase

Direct Gemini image generation is intentionally not invoked by the free-phase poster demo. Supply an existing local base image:

```bash
export POSTER_BASE_IMAGE_PATH="/absolute/path/to/base-image.jpg"
npm run poster:demo
```

When the project moves to paid Gemini, direct Nano Banana image generation can be wired behind the existing generic image-provider contract.

## Current milestones

1. Tenant isolation — implemented.
2. Verified truth / conflict handling — implemented.
3. T001 ATTHA'S onboarding — implemented.
4. Deterministic campaign preflight — implemented.
5. Fact-gated Gemini campaign generation — implemented.
6. Deterministic poster renderer — implemented; direct Gemini image generation waits for paid tier.
7. Gemini image/TTS/Veo production adapters — paid-phase work.
8. Persistence, automation and dashboard — later phases.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the broader implementation plan.
