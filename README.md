# AI Creative OS

Multi-client AI creative and marketing operating system for campaign strategy, content generation, QA, brand governance, and AI media workflows.

## Current scope

AI Creative OS is currently an **internal three-client operating system** for:

- **T001 — ATTHA'S**
  - ATTHA'S Authentic Multi Cuisine
  - ATTHA'S Burger
- **T002 — SKK Meat Goodies**
- **T003 — Lifeline Association Sri Lanka**

Phase 1 established tenant isolation, verified-fact gates, risk handling, structured truth, brand governance and acceptance tests. Phase 2 is adding AI campaign generation behind those deterministic controls.

## Golden principle

> **Facts are retrieved. Rules are enforced. Creativity is generated. Quality is reviewed. Humans decide only when judgment or risk requires them.**

## What this repository contains

```text
ai-creative-os/
├── clients/                 Tenant-safe brand, truth and campaign data
├── config/                  Tenant/provider configuration
├── docs/                    Architecture, security, roadmap and AI workflows
├── prompts/                 Versioned AI operating prompts
├── schemas/                 Machine-readable workflow contracts
├── scripts/                 Local demos and verification utilities
├── src/                     Orchestration, truth gates and provider logic
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

This demonstrates tenant validation, truth resolution and fact gating without calling an AI provider.

## AI campaign demo

Set an OpenAI API key in your shell, then run:

```bash
export OPENAI_API_KEY="..."
npm run campaign:ai-demo
```

The AI provider is called **only after campaign preflight passes**. Routine generation defaults to the cost-conscious model configured in `.env.example` and can be overridden with `OPENAI_CAMPAIGN_MODEL`.

See [`docs/AI_CAMPAIGN_GENERATOR.md`](docs/AI_CAMPAIGN_GENERATOR.md) for the generation pipeline and safety boundaries.

## Current milestones

1. Tenant isolation — implemented.
2. Verified truth / conflict handling — implemented.
3. T001 ATTHA'S onboarding — implemented.
4. Deterministic `/create-campaign` preflight — implemented.
5. Fact-gated AI campaign generation — in progress.
6. Image-generation pipeline — planned after campaign quality validation.
7. Persistence, automation and dashboard — later phases.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the broader implementation plan.
