# AI Campaign Generator

## Status

Campaign Generator V2: provider-routed campaign generation behind deterministic truth, brand-governance, and production-safety gates.

## Core rule

**AI is never called when campaign preflight fails, and generated output is never accepted until it passes structural, factual-placement, and brand-governance validation.**

The flow is:

```text
Campaign request
  ↓
Tenant / brand validation
  ↓
Truth resolution
  ↓
Fact gate
  ├─ FAIL → BLOCKED_MISSING_VERIFIED_DATA
  └─ PASS
       ↓
Load brand context + governance
       ↓
Build fact-safe generation prompt
       ↓
Provider router
  ├─ Groq
  └─ OpenAI
       ↓
Parse structured JSON
       ↓
Validate concept roles + output contract
       ↓
Validate deterministic fact placement
       ↓
Validate brand governance
       ↓
Accepted campaign creative
```

## Provider strategy

The provider layer is abstracted behind `CampaignGenerationProvider`.

Current implementations:

- `GroqResponsesProvider` for free-tier / low-cost development
- `OpenAIResponsesProvider` for OpenAI-backed generation when API billing is available
- `providerRouter.ts` selects the active provider without changing campaign logic

Example development configuration:

```bash
export AI_CAMPAIGN_PROVIDER="groq"
export GROQ_API_KEY="..."
export GROQ_CAMPAIGN_MODEL="openai/gpt-oss-120b"
```

OpenAI can be selected later with:

```bash
export AI_CAMPAIGN_PROVIDER="openai"
export OPENAI_API_KEY="..."
export OPENAI_CAMPAIGN_MODEL="gpt-5.6-luna"
```

Never commit API keys.

## Concept strategy contract

Every accepted generation contains exactly three strategically distinct concepts:

1. `C1 / conversion` — product clarity, immediate action, ordering intent
2. `C2 / crave-emotion` — appetite, sensory desire, emotional craving
3. `C3 / brand-building` — repeatable brand territory without invented claims

The provider must recommend exactly one of those concepts.

## Brand governance

Client identity assets are classified separately from creative guidance.

Current states:

- `APPROVED`
- `PROPOSED`
- `LEGACY`
- `MISSING`

When proposed identity is not explicitly allowed, the production validator rejects proposed taglines, colours, typography, logos, or other configured identity terms that leak into customer-facing output.

For T001, the current rebrand tagline, palette, and typography remain proposed and are therefore blocked from production output by default.

## Image production contract

Campaign Generator V2 deliberately separates visual generation from critical text rendering.

`imageGeneration` contains:

- `basePrompt`
- `negativePrompt`
- `visualConstraints`
- `textPolicy: NO_TEXT_OR_LOGOS`

The base image prompt must not ask an image model to render promotional text, prices, numbers, logos, badges, or labels.

`overlaySpec` contains deterministic customer-facing text such as:

- headline
- supporting copy
- verified price when required
- CTA
- logo usage
- placement hints

This allows a later HTML/CSS renderer to place factual text deterministically rather than trusting image-model typography.

## Fact-placement safety

When a verified price is part of campaign preflight:

- the exact verified value must be preserved in `overlaySpec.price`
- the price must not appear in `imageGeneration.basePrompt`
- source/branch/channel scope remains intact

A mutated price or leaked image-generation price instruction causes the generation to fail.

## Demo

```bash
npm run campaign:ai-demo
```

The T001 demo:

1. Reads the current Wellampitiya Uber Eats pricing snapshot.
2. Resolves the Crispy Chicken Burger as a source-specific fact.
3. Loads ATTHA'S Burger brand rules and master positioning.
4. Loads `brands/master/governance.json`.
5. Runs deterministic preflight.
6. Routes generation through the configured provider.
7. Validates structure, verified-price placement, concept roles, logo policy, and proposed-identity leakage.
8. Exposes creative output only after all checks pass.

## Next steps

- deterministic HTML/CSS poster renderer
- generation cost/token telemetry
- prompt/version metadata on each campaign
- automated creative scoring and revision loop
- campaign and approval persistence
- low-cost image draft provider
- premium image escalation only after static direction approval
