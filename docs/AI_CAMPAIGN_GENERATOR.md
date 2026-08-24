# AI Campaign Generator

## Status

Campaign Generator V3: Gemini-backed generation behind deterministic truth, claim, brand, format, and production-safety controls, with automatic repair when generated creative is invalid.

## Core rule

**Gemini is never called when campaign preflight fails, and generated output is never accepted until it passes every deterministic validator. Model mistakes are repaired automatically before the workflow fails.**

```text
Campaign request
  ↓
Tenant / brand validation
  ↓
Truth resolution + fact gate
  ├─ FAIL → BLOCKED_MISSING_VERIFIED_DATA
  └─ PASS
       ↓
Resolve deterministic platform format
       ↓
Build fact-safe generation prompt
       ↓
Gemini campaign provider
       ↓
Native JSON response mode
       ↓
Parse structured JSON
       ↓
Validate structure + concept roles
       ↓
Validate price placement + format
       ↓
Validate unsupported product/service claims
       ↓
Validate brand governance
       ↓
PASS ───────────────→ accepted creative
  │
  FAIL
  ↓
Collect validator error
  ↓
Repair prompt with exact violation
  ↓
Regenerate and revalidate
  ↓
Up to 2 repairs by default
```

## Gemini text model strategy

Creative OS uses one provider family: Google Gemini.

- `gemini-3.5-flash-lite` — routine/bulk generation
- `gemini-3.6-flash` — creative-direction work
- `gemini-3.7-flash` — advanced Flash work
- `gemini-3.1-pro-preview` — deep/sensitive/high-reputation-risk review

`GeminiCampaignProvider` accepts a text role (`default`, `creative`, `advanced`, `review`). `selectGeminiTextRole()` provides deterministic escalation from task context so stronger models are not used by default merely because billing is available.

Environment overrides:

```bash
GEMINI_CAMPAIGN_MODEL=gemini-3.5-flash-lite
GEMINI_CREATIVE_MODEL=gemini-3.6-flash
GEMINI_ADVANCED_FLASH_MODEL=gemini-3.7-flash
GEMINI_REVIEW_MODEL=gemini-3.1-pro-preview
```

## Structured output

`GeminiCampaignProvider` calls Gemini `generateContent` and requests JSON output. The model is not trusted as a source of truth; Creative OS parses the returned JSON and applies deterministic validators.

## Concept strategy contract

Every accepted generation contains exactly three strategically distinct concepts:

1. `C1 / conversion` — product clarity, immediate action, ordering intent
2. `C2 / crave-emotion` — appetite and emotional desire without invented product attributes
3. `C3 / brand-building` — repeatable territory without invented claims

## Claim governance

Product/service-specific customer-facing claims must be supported by verified facts or explicitly allowed by policy.

The default validator blocks unsupported categories including:

- sensory/ingredient claims such as juicy, spicy, fresh, cheese, sauce, sesame
- superiority/award claims such as best, largest, award-winning, 100%
- availability/urgency claims such as available now, currently available, today, limited time
- popularity/status claims such as signature, bestseller, customer favourite, most popular, most ordered
- service-performance claims such as reliable, consistent delivery, delivered directly, fast/instant delivery

A term present in verified facts is allowed. Brand-specific policy can also explicitly allow creative terms or add blocked terms.

## Brand governance

Identity assets remain classified independently as `APPROVED`, `PROPOSED`, `LEGACY`, or `MISSING`. Proposed identity cannot leak into production creative unless explicitly enabled.

## Deterministic money

The model does not control how money is displayed. Provider output uses structured numeric data, application code validates it against verified truth, and the final display value is created deterministically.

## Deterministic platform formats

The model cannot choose the final aspect ratio. Platform dimensions are resolved by application code and validated after generation.

## Image production contract

`imageGeneration` is visual-only:

- `basePrompt`
- `negativePrompt`
- `visualConstraints`
- `textPolicy: NO_TEXT_OR_LOGOS`

Critical text remains in `overlaySpec` for deterministic HTML/CSS rendering. Verified prices must never appear in the base image prompt.

## Automatic repair

`generateCampaign()` allows two repair attempts by default and supports `maxRepairAttempts` from 0 to 3.

When validation fails, Gemini receives the original campaign contract, the exact validator failure, its previous invalid output, and an instruction to return a complete corrected JSON object.

## Usage telemetry

`GeminiCampaignProvider.lastUsage` records token usage when the API returns `usageMetadata`, plus a versioned estimated paid-tier token cost where pricing for the selected model is known.

The estimate is observability data only. Google billing is the final cost source.

## Demo

```bash
export GEMINI_API_KEY="..."
export GEMINI_CAMPAIGN_MODEL="gemini-3.5-flash-lite"
npm run campaign:ai-demo
```

The demo reads source-scoped truth, loads brand governance, resolves the production format, generates through Gemini, repairs invalid output when possible, and exposes creative output only after all validators pass.

## Media production

The billed Gemini stack is active behind explicit spend controls:

- image draft: `gemini-3.1-flash-lite-image`
- image production: `gemini-3.1-flash-image`
- image premium: `gemini-3-pro-image`
- TTS: `gemini-3.1-flash-tts-preview`
- video: Veo 3.1 Lite / Fast / Premium

Paid media demo commands require explicit runtime opt-in rather than treating billing access as permission to spend.
