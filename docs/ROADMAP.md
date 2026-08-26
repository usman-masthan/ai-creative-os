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
- [x] Import owner-confirmed official branch/address/phone/physical-hours master for the four active V1 branches.
- [x] Prevent a brand-wide task from silently consuming an arbitrary branch-scoped fact.
- [x] Support explicitly branch-scoped truth requirements so identical product names can carry different prices/availability per branch.
- [ ] Import ATTHA’S POS/menu master. **Optional for current V1 because missing data can now be collected just in time.**
- [ ] Reconcile public observations with operational data and lock the authoritative master dataset.

### Just-in-time task truth confirmation

Creative OS now treats stored operational truth as reference material, not automatic permission to publish it.

- [x] Determine the exact truth requirements from the current task/campaign type.
- [x] Ask the user to confirm every stored fact required by the task.
- [x] Ask the user to provide facts that are missing.
- [x] Ask the user to resolve conflicting facts.
- [x] Group confirmation/input into one task-specific questionnaire.
- [x] Create an immutable task-scoped confirmation snapshot.
- [x] Make the canonical user-facing production gateway consume only the confirmed snapshot, never the stored records directly.
- [x] Allow a user correction to apply to the current task without silently overwriting stored truth.
- [x] Record whether the user requested the corrected value to be written back to stored truth.
- [x] Keep branch/product/sales-channel scope attached to every confirmed fact.
- [x] Require separate branch confirmations even when the same item currently has the same price at multiple branches.
- [x] Build a local conversational workspace that renders the confirmation questions as user-friendly forms.
- [x] Add governed local runtime write-back for user-requested corrections using exact key/branch/product/channel scope.
- [ ] Migrate operational truth to a production-grade shared master data store when multi-user deployment is justified.

### Temporarily deferred operational data

These can remain deferred and be requested only when a task actually needs them. They must remain fact-gated and task-confirmed before production:

- dine-in + takeaway prices
- Uber prices / Merchant export freshness
- PickMe prices / Merchant export
- complete ingredients and descriptions
- allergens
- offers + validity dates
- product availability by branch
- real product photographs / photo-rights / SKU mapping

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
- [ ] Import high-resolution original ATTHA’S food photography. **Can be collected just in time per product campaign.**
- [ ] Map SKU → image → branch scope. **Can be collected just in time per product campaign.**
- [ ] Record ownership/licence and advertising approval. **Required before final use of a real product image.**
- [ ] Record verified visible ingredients / must-include / must-not-include per product visual.

## P1 — Visual QA and static production

- [x] Add Gemini multimodal visual-QA provider foundation.
- [x] Define QA categories: product truth, brand fit, realism, composition, governance and rights.
- [x] Define `PASS / REGENERATE / HUMAN_REVIEW / BLOCK` decisions.
- [x] Add deterministic rights/concept/score guards around model review.
- [x] Allow poster production to run visual QA before final rendering.
- [x] Stop raw image base64 from being written to the manifest/result.
- [x] Apply ATTHA’S Burger working palette/CTA/type direction to the first deterministic hero layout.
- [x] Build deterministic five-family Burger layout library: hero, promotional price, offer/deal, minimal premium and story vertical.
- [x] Build deterministic five-family Restaurant layout library: food hero, editorial, multi-dish, hospitality and story vertical.
- [x] Add deterministic brand/aspect-safe layout selector and persist the selected layout in poster manifests.
- [x] Add automatic bounded safe regeneration loop for `REGENERATE` visual-QA decisions.
- [x] Feed each selected layout’s copy-safe / negative-space composition requirements into initial and regenerated image prompts.
- [x] Add final-art QA for legibility, hierarchy, safe area, contrast, brand fit and platform fit.
- [ ] Connect visual QA to real approved product/reference records in the live ATTHA’S workflow. **Blocked until the relevant task supplies approved product-photo truth.**
- [ ] Add approved master/Burger/Restaurant logo placement once final lockups exist.
- [ ] Validate all ten layout families with real ATTHA’S campaigns.

## P1 — Gemini reliability and spend

- [x] Gemini-only text/image/TTS/Veo provider stack.
- [x] Centralised text/image/video model roles.
- [x] Native structured campaign JSON generation and repair loop.
- [x] Provider usage and estimated-cost telemetry.
- [x] Runtime paid-media opt-in and premium escalation guards.
- [x] Add bounded automatic 429/503 retry/backoff.
- [x] Add persistent hashed prompt/output usage logging.
- [x] Add per-campaign spend ledger and hard budget caps.
- [x] Add explicit premium-spend approval thresholds.

## P2 — Creative Director and marketing operations

- [x] Objective → strategy → maximum three concepts.
- [x] Creative Director 8-dimension critique/ranking with deterministic highest-score winner validation.
- [x] Selected concept → improvement directives → production-safe brief/copy/image-direction finalization.
- [x] Preserve original concepts, verified prices, aspect ratio and brand/claim governance through bounded finalizer repairs.
- [x] Monthly ATTHA’S marketing plan.
- [x] Weekly content plan and deterministic campaign calendar.
- [x] Classify each planned campaign as `READY_WITH_CURRENT_TRUTH` or `NEEDS_TRUTH_BEFORE_PRODUCTION` using application-owned requirements.
- [x] Protect operating-brand/branch scope and fixed publishing slots during AI planning.
- [x] Planned campaign → truth gate → generation → Creative Director → deterministic layout → draft media → visual QA → bounded regeneration → final renderer as one governed command.
- [x] Support explicit `DRAFT` output while requiring visual-QA `PASS` before `FINAL_RENDERED`.
- [x] One approved concept → Instagram feed/story/reel-cover, Facebook feed and WhatsApp Status adaptations.
- [x] Governed multi-format batch rendering.
- [x] Keep caption/headline/CTA variants tied to the same campaign ID, selected concept, truth version and brand version.
- [x] Preserve deterministic prices and block new numeric/claim-bearing facts during adaptation.
- [x] Add automatic advanced Creative Director escalation when review is close/risky.

## P2 — Persistence and approvals

- [x] Add file-backed campaign persistence for ATTHA’S V1.
- [x] Add asset/media metadata persistence.
- [x] Store truth/brand versions per campaign assets and revisions.
- [x] Store visual-QA/final-art-QA and revision history.
- [x] Store approval lifecycle records and final-use/publication locations.
- [x] Persist campaign spend.
- [x] Store publication and performance records.

Approval lifecycle:

`DRAFT → INTERNAL_REVIEW → CLIENT_REVIEW → REVISION_REQUESTED → APPROVED → PRODUCTION_READY → PUBLISHED → ARCHIVED`

## P3 — Internal ATTHA’S interface

V1 now includes both the low-level operations dashboard/API and a local Marketing Manager workspace. The workspace is intentionally local/internal; it is not yet a hardened public multi-user SaaS application.

- [x] Natural-language campaign request interface.
- [x] Smart task clarification / editable task-intent review screen.
- [x] Task-truth confirmation form generated from the just-in-time questionnaire.
- [x] Truth-memory view and governed local runtime write-back.
- [ ] Full product/image asset library with product/branch/rights metadata.
- [x] Basic Creative Director concept review cards.
- [x] Poster preview after governed production.
- [ ] Rich poster revision controls (change copy/image/layout while preserving campaign locks).
- [ ] Interactive approval queue / lifecycle transition controls.
- [ ] Visual campaign calendar UI.
- [x] Governed local image upload area.
- [x] Local usage/cost/campaign-state visibility.

## Production validation before scaling

- [ ] Run 20–30 real ATTHA’S campaigns across Restaurant and Burger using the confirmation gateway.
- [ ] Measure fact-gate blocks, confirmation burden, repairs, visual-QA failures, human revision rate, cost and time-to-approval.
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
