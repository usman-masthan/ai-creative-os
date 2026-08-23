# AI Campaign Generator

## Status

Phase 2 foundation: OpenAI-backed campaign generation behind the existing deterministic truth gate.

## Core rule

**AI is never called when campaign preflight fails.**

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
Build fact-safe generation prompt
       ↓
OpenAI Responses API
       ↓
Parse + validate structured JSON
       ↓
3 concepts
       ↓
1 recommendation
       ↓
Creative brief + caption + image prompt
```

## Provider strategy

The provider layer is abstracted behind `CampaignGenerationProvider`.

The first implementation is `OpenAIResponsesProvider`, which calls the OpenAI Responses API directly with standard `fetch`. No OpenAI SDK dependency is required at this stage.

Routine generation defaults to `gpt-5.6-luna` because the project prioritizes cost control. The model can be changed through `OPENAI_CAMPAIGN_MODEL` without changing campaign logic.

Higher-cost models should be introduced only after evaluation shows they provide enough creative quality improvement to justify the cost.

## Environment

```bash
export OPENAI_API_KEY="..."
export OPENAI_CAMPAIGN_MODEL="gpt-5.6-luna"
```

Never commit API keys.

## Demo

```bash
npm run campaign:ai-demo
```

The demo:

1. Reads the current T001 Wellampitiya Uber Eats pricing snapshot.
2. Resolves the Crispy Chicken Burger as a source-specific fact.
3. Loads ATTHA'S Burger brand rules and master positioning.
4. Runs deterministic preflight.
5. Calls OpenAI only if preflight passes.
6. Validates the returned JSON before exposing the creative output.

## Output contract

A successful generation must contain exactly three concepts and one recommendation, plus:

- creative brief
- caption
- image prompt
- immutable image constraints
- flexible image-generation elements
- factual QA notes

Malformed or incomplete provider output is rejected.

## Current safety boundaries

- Source-specific prices cannot silently become universal prices.
- Missing/conflicting required facts block AI generation.
- The model receives only facts that passed truth resolution.
- Rebrand proposals must not be described as officially approved.
- Important factual overlay text should not be entrusted to image-generation models.

## Next steps

- add generation cost/token telemetry
- add prompt/version metadata to each generated campaign
- add deterministic post-generation fact scan
- add creative scoring/revision loop
- persist campaigns and approvals
- add low-cost image draft provider after campaign quality is validated
