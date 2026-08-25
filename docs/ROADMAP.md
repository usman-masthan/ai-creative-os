# Roadmap — ATTHA’S V1 First

ATTHA’S is the only active V1 client. Multi-client generalisation is postponed until the ATTHA’S system has survived real production validation.

## P0 — ATTHA’S operating foundation

- [x] Define tenant/truth/risk foundation.
- [x] Define deterministic fact gate and scope-aware truth resolver.
- [x] Model ATTHA’S master / Restaurant / Burger relationship.
- [x] Add public-web baseline for Wellawatte, Wellampitiya, Bambalapitiya and Kollupitiya.
- [x] Reconcile public address/hour/contact conflicts into an explicit conflict register.
- [x] Refresh public Uber pricing/menu snapshots to 24 August 2026.
- [x] Separate branch/channel/date-scoped public truth from universal official truth.
- [ ] Import ATTHA’S POS/menu master.
- [ ] Import official branch/contact/hours master.
- [ ] Import dine-in and takeaway price masters.
- [ ] Import Uber Merchant export.
- [ ] Import PickMe Merchant export.
- [ ] Import complete ingredient and allergen records.
- [ ] Import promotion start/end dates and current availability feed.
- [ ] Reconcile public observations with operational data and lock the authoritative master dataset.

## P1 — ATTHA’S brand system

- [x] Add approved working colour system.
- [x] Add working typography hierarchy.
- [x] Add endorsed sub-brand architecture.
- [x] Add tone-of-voice and CTA rules.
- [x] Add photography/visual rules.
- [x] Add layout, spacing and social-zone rules.
- [x] Add AI visual-consistency rules.
- [x] Add brand governance/release checklist.
- [x] Add machine-readable brand tokens.
- [x] Source-control owner-supplied A/fork symbol.
- [ ] Approve/source-control final ATTHA’S master wordmark vector.
- [ ] Approve Burger logo lockups and variants.
- [ ] Approve Restaurant logo lockups and variants.
- [ ] Confirm `Passion for flavour` final decision.
- [ ] Confirm primary font licences and multilingual typefaces.
- [ ] Confirm halal-mark rules/certification evidence.
- [ ] Calibrate print colour when print production is required.

## P1 — Product visual truth

- [x] Define `VERIFIED_PRODUCT_VISUAL`, `CONSTRAINED_PRODUCT_GENERATION` and `GENERIC_CONCEPT_VISUAL`.
- [x] Add machine-readable visual-asset schema and empty product-image registry.
- [x] Enforce policy that AI imagery is not evidence of product appearance.
- [x] Enforce branch-image isolation policy.
- [ ] Import high-resolution original ATTHA’S food photography.
- [ ] Map SKU → image → branch scope.
- [ ] Record ownership/licence and advertising approval.
- [ ] Record verified visible ingredients / must-include / must-not-include per product visual.

## P1 — Visual QA and static production

- [x] Add Gemini multimodal visual-QA provider foundation.
- [x] Define QA categories: product truth, brand fit, realism, composition, governance and rights.
- [x] Define `PASS / REGENERATE / HUMAN_REVIEW / BLOCK` decisions.
- [x] Add deterministic rights/concept/score guards around model review.
- [x] Allow poster production to run visual QA before final rendering.
- [x] Stop raw image base64 from being written to the manifest/result.
- [x] Apply ATTHA’S Burger working palette/CTA/type direction to the first deterministic hero layout.
- [ ] Connect visual QA to real approved product/reference records in the live ATTHA’S workflow.
- [ ] Add automatic safe regeneration loop for `REGENERATE` decisions.
- [ ] Build approved Burger promotional / editorial layout families.
- [ ] Build approved Restaurant dish / shared-table / promotional layout families.
- [ ] Add approved master/Burger/Restaurant logo placement once final lockups exist.
- [ ] Add stronger final-art legibility/crop/platform QA.

## P1 — Gemini reliability and spend

- [x] Gemini-only text/image/TTS/Veo provider stack.
- [x] Centralised text/image/video model roles.
- [x] Native structured campaign JSON generation and repair loop.
- [x] Provider usage and estimated-cost telemetry.
- [x] Runtime paid-media opt-in and premium escalation guards.
- [ ] Add automatic 429/503 retry/backoff and availability fallback.
- [ ] Add persistent prompt/output usage logging.
- [ ] Add per-campaign spend ledger and hard budget caps.

## P2 — Creative Director and marketing operations

After P0/P1 truth and visual safety are reliable:

- [ ] Objective → strategy → maximum three concepts.
- [ ] Creative Director critique/ranking and explicit winner selection.
- [ ] Selected concept → brief → draft → QA → revision → final orchestration.
- [ ] Monthly ATTHA’S marketing plan.
- [ ] Weekly content plan and campaign calendar.
- [ ] One approved concept → feed/story/reel-cover/Facebook/WhatsApp adaptations.
- [ ] Caption/headline/CTA variants tied to the same approved truth/version.

## P2 — Persistence and approvals

- [ ] Add campaign persistence.
- [ ] Add asset/media persistence.
- [ ] Store truth/brand/model/prompt versions per campaign.
- [ ] Store visual-QA and revision history.
- [ ] Store approval records and final-use locations.
- [ ] Persist campaign spend.

Approval lifecycle:

`draft → internal_review → client_review → approved → published → archived`

## P3 — Internal ATTHA’S interface

Only after the CLI workflow is trustworthy:

- [ ] Campaign creation interface.
- [ ] Truth/conflict review.
- [ ] Product/image library.
- [ ] Creative review screen.
- [ ] Approval queue.
- [ ] Campaign calendar.
- [ ] Usage/cost visibility.

## Production validation before scaling

- [ ] Run 20–30 real ATTHA’S campaigns across Restaurant and Burger.
- [ ] Measure fact-gate blocks, repairs, visual-QA failures, human revision rate, cost and time-to-approval.
- [ ] Fix recurring production failures.
- [ ] Confirm the system can produce publishable work with minimal manual correction.

## Deliberately postponed

- SKK-specific workflows
- Lifeline-specific workflows
- public signup
- SaaS billing/subscriptions
- generalized tenant dashboard/switcher
- marketplace
- advanced RBAC
- automatic publishing everywhere
- large industry packs
- broad RAG/platform generalisation

Scale only after ATTHA’S V1 is proven.
