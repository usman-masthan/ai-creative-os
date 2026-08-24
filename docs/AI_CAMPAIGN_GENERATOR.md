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

## Gemini model strategy

Creative OS uses one provider family: Google Gemini.

Current model roles:

- `gemini-3.5-flash-lite` — default/bulk campaign generation
- `gemini-3.6-flash` — stronger creative-direction work
- `gemini-3.7-flash` — optional latest-Flash path when availability is good
- `gemini-3.1-pro-preview` — paid-phase deep/sensitive review

Campaign generation defaults to `gemini-3.5-flash-lite` and can be overridden with `GEMINI_CAMPAIGN_MODEL`.

Example:

```bash
export GEMINI_API_KEY="..."
export GEMINI_CAMPAIGN_MODEL="gemini-3.5-flash-lite"
npm run campaign:ai-demo
```

Never commit API keys.

## Structured output

`GeminiCampaignProvider` calls the Gemini `generateContent` endpoint and requests:

```json
{
  "generationConfig": {
    "responseMimeType": "application/json"
  }
}
```

The model is still not trusted as a source of truth. Creative OS parses the returned JSON and applies its own deterministic validators.

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

## Brand governance

Identity assets remain classified independently:

- `APPROVED`
- `PROPOSED`
- `LEGACY`
- `MISSING`

Proposed identity cannot leak into production creative unless explicitly enabled.

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

## Demo

```bash
npm run campaign:ai-demo
```

The demo reads source-scoped truth, loads brand governance, resolves the production format, generates through Gemini, repairs invalid output when possible, and exposes creative output only after all validators pass.

## Media phase

The Gemini model catalog already defines the paid-phase media models:

- image draft: `gemini-3.1-flash-lite-image`
- image production: `gemini-3.1-flash-image`
- image premium: `gemini-3-pro-image`
- TTS: `gemini-3.1-flash-tts-preview`
- video: Veo 3.1 Lite / Fast / Premium

Direct paid media adapters are enabled only when billing is deliberately introduced.
