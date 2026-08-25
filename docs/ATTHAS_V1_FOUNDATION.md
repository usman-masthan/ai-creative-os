# ATTHA’S Creative OS V1 Foundation

ATTHA’S is the only active client scope for V1. Multi-client scalability remains an architectural constraint, not an active implementation priority.

## Definition of done

ATTHA’S Creative OS V1 is production-ready only when all of the following are true:

1. Brand identity is technically locked and approved.
2. Authoritative branch/product/channel truth is reconciled with ATTHA’S operational data.
3. Product visual truth is mapped to approved real/reference imagery.
4. Creative generation consumes ATTHA’S brand and truth rules automatically.
5. Static output is professionally branded and format-safe.
6. Visual QA and approval/revision gates prevent unsafe or inaccurate publication.

## Current implementation status

### Implemented

- ATTHA’S master / Restaurant / Burger architecture.
- Source-aware truth statuses and deterministic fact gating.
- Gemini-only text/image/TTS/Veo provider stack.
- Campaign JSON generation with repair loops.
- Claim, price, brand and format validation.
- Deterministic price/CTA overlays.
- Paid-media opt-in and cost telemetry.
- Working ATTHA’S brand-system documentation and machine-readable tokens.
- Owner-supplied A/fork working symbol in source-controlled SVG.
- Public-web baseline for the four current V1 locations.
- Product visual-truth policy and registry foundation.

### Partially implemented

- Authoritative branch truth: public data is reconciled, operational owner/POS/merchant confirmation remains.
- Logo system: A/fork symbol exists; approved master wordmark, Restaurant lockup and Burger lockup remain pending.
- Typography: working families exist; final font/licence and multilingual decisions remain pending.
- Poster renderer: technically deterministic but not yet fully driven by the ATTHA’S design system.
- Cost governance: estimates/guards exist; persistent spend ledger and hard campaign caps remain.

### Not yet implemented

- Product-photo library with SKU/branch/rights mapping.
- Multimodal visual QA implementation.
- Automatic `PASS / REGENERATE / HUMAN_REVIEW / BLOCK` visual decision engine.
- Professional multi-layout ATTHA’S template library.
- Persistent campaign/revision/approval history.
- Marketing planner/calendar and multi-format adaptation.

## P0 — Authoritative truth completion

Required operational inputs from ATTHA’S:

1. POS/menu master.
2. Official branch list and contacts.
3. Dine-in price list.
4. Takeaway price list.
5. Uber Merchant export.
6. PickMe Merchant export.
7. Complete ingredient records.
8. Allergen records.
9. Offer start/end dates.
10. Current product availability by branch/channel.
11. Original high-resolution food photographs.
12. SKU-to-photo mapping and advertising rights.

Public-web observations must remain channel/date scoped. They are evidence, not permission to silently create universal master truth.

## P1 — Brand and visual truth

### Brand identity

- Approve final vector ATTHA’S wordmark.
- Approve master horizontal/reversed/one-colour lockups.
- Approve Burger lockup.
- Approve Restaurant lockup.
- Confirm `Passion for flavour` decision.
- Confirm primary and multilingual typefaces/licences.
- Confirm halal-mark rules/evidence.
- Calibrate print colour when print production is required.

### Product visual truth

Every candidate image must be classified as one of:

- `VERIFIED_PRODUCT_VISUAL`
- `CONSTRAINED_PRODUCT_GENERATION`
- `GENERIC_CONCEPT_VISUAL`

Generic concept imagery may never be represented as the actual ATTHA’S menu item.

## P1 — Visual QA

Implement Gemini multimodal review after image generation and before final rendering.

Mandatory categories:

1. Product truth — ingredients, portion and product form.
2. Brand fit — correct Restaurant/Burger mood, palette and visual density.
3. Realism — no malformed food, hands, utensils, packaging or impossible geometry.
4. Composition — copy-safe area and crop resilience.
5. Governance — correct visual classification and generation record.
6. Rights — source/reference/output cleared for intended use.

Final decision enum:

- `PASS`
- `REGENERATE`
- `HUMAN_REVIEW`
- `BLOCK`

## P1 — Brand-aware static production

Replace the generic poster treatment with approved ATTHA’S layout families. Gemini may select an approved family but must not invent arbitrary production CSS.

Initial layout families:

- Burger hero product.
- Burger promotional price/offer.
- Burger editorial/crave.
- Restaurant editorial dish.
- Restaurant shared-table/occasion.
- Restaurant promotional offer.

Each layout must preserve the five social zones:

1. Brand.
2. Appetite.
3. Message.
4. Action.
5. Compliance.

## P2 — Creative Director and marketing operations

Once truth + visuals + static production are trustworthy:

- Objective → strategy → maximum three concepts.
- Creative Director critique/ranking.
- Selected concept → brief → draft → QA → revision → final.
- Monthly/weekly content plan and campaign calendar.
- One approved concept adapted to feed, story, reel cover, Facebook/WhatsApp and copy variants.

## P2 — Persistence and approvals

Persist:

- campaign request and truth version,
- brand version,
- model/prompt versions,
- generation records,
- visual QA,
- revisions,
- approvals,
- asset usage,
- costs.

Approval lifecycle:

`draft → internal_review → client_review → approved → published → archived`

## Deliberately postponed

Until ATTHA’S V1 has survived real production validation:

- SKK integration,
- Lifeline integration,
- public SaaS,
- public signup,
- subscriptions/SaaS billing,
- tenant switcher/dashboard generalisation,
- marketplace,
- advanced RBAC,
- automatic publishing everywhere,
- large industry packs.

## Production validation before scaling

Run at least 20–30 real ATTHA’S campaigns across Restaurant and Burger. Track:

- fact-gate blocks,
- generation repairs,
- visual-QA failures,
- human revision rate,
- average generation cost,
- time to approved asset,
- branch/channel accuracy,
- reusable layout performance.

Scale to the next client only after the system can reliably produce publishable ATTHA’S work with minimal manual correction.
