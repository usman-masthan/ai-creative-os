# ATTHA’S Creative Director V1

The Creative Director stage sits between initial campaign generation and static production.

## Workflow

`objective → verified truth preflight → 3 concepts → Creative Director review → winner → finalization → deterministic layout → image/visual QA → poster`

The initial generator still produces exactly three strategic roles:

1. `C1` — conversion
2. `C2` — crave-emotion
3. `C3` — brand-building

The Creative Director does not create a fourth concept and is not allowed to introduce new customer-facing facts.

## Scoring

Every concept receives an integer score from 1–10 for:

- strategic fit
- ATTHA’S brand fit
- originality
- emotional strength
- conversion potential
- visual potential
- factual safety
- production efficiency

The application calculates each total deterministically and rejects a winner that does not share the highest total score.

## Winner finalization

The production finalizer must:

- keep the original `C1/C2/C3` concepts byte-for-structure equivalent
- set `recommendedConceptId` to the Creative Director winner
- improve only the final recommendation, brief, caption, image direction and deterministic overlay spec
- preserve the required platform aspect ratio
- preserve verified price values and keep them out of image prompts
- preserve logo governance
- pass the existing claim and brand governance gates

A finalizer that breaks these rules enters the bounded repair loop and is rejected after the configured repair limit.

## Gemini roles

Recommended runtime mapping:

- campaign generation / production finalizer: `default` → Gemini 3.5 Flash Lite
- senior Creative Director: `creative` → Gemini 3.6 Flash
- difficult review escalation: `advanced` → Gemini 3.7 Flash (next refinement)
- rare deep review: `review` → Gemini 3.1 Pro Preview (human-controlled/high-value work)

The command layer is provider-agnostic so tests and future routing can use deterministic mock providers.

## Safety

Creative Director review never upgrades missing or deferred data into verified truth. Prices, offers, ingredients, allergens, product availability and product appearance remain governed by the existing truth/visual gates.

The Creative Director may prefer a safer concept when another concept has stronger creative energy but relies on unsupported facts.
