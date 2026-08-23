# AI Creative OS

Multi-client AI creative and marketing operating system for campaign strategy, content generation, QA, brand governance, and AI media workflows.

## Current scope

Phase 1 is an **internal three-client operating system** for:

- **T001 — ATTHA'S**
  - ATTHA'S Authentic Multi Cuisine
  - ATTHA'S Burger
- **T002 — SKK Meat Goodies**
- **T003 — Lifeline Association Sri Lanka**

The architecture is intentionally lean. It establishes tenant isolation, verified-fact gates, brand rules, creative workflows, QA, approval handling, provider abstraction, and acceptance tests before investing in a full SaaS platform.

## Golden principle

> **Facts are retrieved. Rules are enforced. Creativity is generated. Quality is reviewed. Humans decide only when judgment or risk requires them.**

## What this repository contains

```text
ai-creative-os/
├── clients/                 Tenant-safe templates and local operating folders
├── config/                  Tenant/provider configuration
├── docs/                    Architecture, security, and roadmap
├── prompts/                 Versioned AI operating prompts
├── schemas/                 Machine-readable workflow contracts
├── src/                     Lightweight orchestration/domain logic
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
npm test
npm run typecheck
```

## Phase 1 goals

1. Establish tenant isolation.
2. Block unverified customer-facing facts.
3. Encode different risk levels for commercial and NGO content.
4. Create a master operating prompt.
5. Add deterministic QA and human-escalation gates.
6. Keep expensive media generation behind approval gates.
7. Validate the design against representative acceptance scenarios.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the next implementation phases.
