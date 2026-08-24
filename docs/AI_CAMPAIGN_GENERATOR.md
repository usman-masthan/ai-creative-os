# AI Campaign Generator

## Status

Campaign Generator V3: provider-routed generation behind deterministic truth, claim, brand, format, and production-safety controls, with automatic repair when a provider returns invalid creative.

## Core rule

**AI is never called when campaign preflight fails, and generated output is never accepted until it passes every deterministic validator. Provider mistakes are repaired automatically before the workflow fails.**

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
Provider router (Groq / OpenAI)
       ↓
Parse structured JSON
       ↓
Validate structure + concept roles
       ↓
Validate price placement + format
       ↓
Validate unsupported product claims
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

Never commit API keys.

## Concept strategy contract

Every accepted generation contains exactly three strategically distinct concepts:

1. `C1 / conversion` — product clarity, immediate action, ordering intent
2. `C2 / crave-emotion` — appetite and emotional desire without invented product attributes
3. `C3 / brand-building` — repeatable territory without invented claims

## Claim governance

Product-specific customer-facing claims must be supported by verified facts or explicitly allowed by policy.

The default validator blocks unsupported language such as:

- juicy
- spicy
- fresh
- homemade / handmade
- organic
- healthy / low calorie
- best / biggest / largest
- award-winning
- 100%

A word present in verified facts is allowed. Brand-specific policies can also add allowed creative terms or additional blocked terms.

This separates a verified product name like `Crispy Chicken Burger` from an unverified assertion such as `juicy inside`.

## Brand governance

Identity assets remain classified independently:

- `APPROVED`
- `PROPOSED`
- `LEGACY`
- `MISSING`

Proposed identity cannot leak into production creative unless explicitly enabled. For T001 the current rebrand tagline, palette, typography and logo remain proposed.

## Deterministic money

The provider does not control how money is displayed.

Provider output uses structured data:

```json
{
  "price": {
    "amount": 950,
    "currency": "LKR"
  }
}
```

Application code validates the numeric amount against the verified truth record and creates the display value deterministically:

```text
LKR 950
```

This prevents provider-created variants such as `950`, `Rs 950`, or mutated prices from becoming the source of truth.

## Deterministic platform formats

The campaign provider cannot choose the final aspect ratio.

Current defaults include:

- Instagram feed/poster: `1080x1350`, `4:5`
- Instagram Story/Reel: `1080x1920`, `9:16`
- TikTok: `1080x1920`, `9:16`
- Facebook feed/poster: `1080x1350`, `4:5`
- Facebook Story/Reel: `1080x1920`, `9:16`

If provider output drifts from the resolved format, validation fails and the repair loop corrects it.

## Image production contract

`imageGeneration` is visual-only:

- `basePrompt`
- `negativePrompt`
- `visualConstraints`
- `textPolicy: NO_TEXT_OR_LOGOS`

Critical text remains in `overlaySpec` for a future deterministic HTML/CSS renderer.

Verified prices must never appear in the base image prompt.

## Production complexity scoring

After a campaign passes validation, Creative OS calculates production complexity deterministically.

Complexity increases for elements such as:

- people / hands
- phones or app screens
- third-party logos/icons
- multiple products or sharing scenes
- complex environments
- flying/motion food effects

The final result includes:

```json
{
  "production": {
    "format": { "aspectRatio": "4:5", "width": 1080, "height": 1350 },
    "complexity": { "score": 0, "level": "low", "reasons": [] }
  }
}
```

For direct-response food posters, lower-complexity hero-first production is preferred unless complexity adds clear strategic value.

## Automatic repair

`generateCampaign()` allows two repair attempts by default and supports `maxRepairAttempts` from 0 to 3.

When validation fails, the provider receives:

- the original campaign contract
- the exact validator failure
- its previous invalid output
- an instruction to return a complete corrected JSON object

The final result records `generation.attempts` and `generation.repairs` for observability.

## Demo

```bash
npm run campaign:ai-demo
```

The T001 demo reads source-scoped Wellampitiya Uber Eats facts, loads ATTHA'S governance, resolves the Instagram production format, generates through the configured provider, repairs provider errors when needed, and exposes creative output only after all validators pass.

## Next milestone

Campaign generation is now mature enough to move into the production pipeline:

1. low-cost / free image draft provider
2. deterministic HTML/CSS poster renderer
3. visual QA
4. human approval
5. final export

Premium generation should only be escalated after static creative direction is approved.
