# Roadmap

## Phase 1 — Operating foundation

- [x] Define tenant registry
- [x] Define verified-truth gate
- [x] Define risk model
- [x] Version the master operator prompt
- [x] Add campaign and approval schemas
- [x] Add acceptance scenarios
- [x] Add minimal TypeScript domain logic
- [x] Start T001 source-aware truth onboarding
- [ ] Confirm T001 official master prices/hours/contacts with management
- [ ] Populate brand rules/assets
- [ ] Run all acceptance scenarios manually against the master prompt
- [x] Add deterministic T001 campaign preflight / truth resolver

## Phase 2 — Gemini orchestration

- [x] Add Gemini text campaign adapter
- [x] Centralize Gemini model roles
- [x] Remove OpenRouter, Groq and OpenAI campaign providers
- [x] Remove getimg.ai image dependency
- [x] Request JSON output from Gemini campaign generation
- [x] Add explicit Creative Director role using `gemini-3.6-flash`
- [x] Add advanced Flash role using `gemini-3.7-flash`
- [x] Add deep-review role using `gemini-3.1-pro-preview`
- [x] Add deterministic text-role escalation policy
- [x] Add provider usage and estimated-cost telemetry
- [ ] Add automatic 429/503 retry/backoff and availability fallback
- [ ] Add persistent prompt/output usage logging

## Phase 3 — Paid Gemini media

Billing is enabled, but paid media remains runtime opt-in.

- [x] Add Nano Banana 2 Lite draft-image adapter
- [x] Add Nano Banana 2 production-image adapter
- [x] Add Nano Banana Pro premium-image adapter
- [x] Add direct Gemini image data to deterministic poster production
- [x] Add Gemini 3.1 Flash TTS adapter
- [x] Add Veo 3.1 Lite video adapter
- [x] Add Veo 3.1 Fast video role
- [x] Add Veo 3.1 premium video role
- [x] Add image/video cost estimation
- [x] Add runtime paid-media opt-in and escalation guards
- [x] Deterministic HTML/CSS poster renderer
- [x] Deterministic factual overlays
- [ ] Add persistent per-campaign spend ledger and hard budget caps
- [ ] Add visual QA for generated product accuracy/crop/legibility

## Phase 4 — Storage and workflow automation

- [ ] Add PostgreSQL/Supabase persistence
- [ ] Add R2 media storage
- [ ] Add campaign history
- [ ] Add approval records
- [ ] Add n8n workflows where they reduce manual work

## Phase 5 — Internal dashboard

- [ ] Campaign creation interface
- [ ] Tenant switcher with isolation safeguards
- [ ] Creative review screen
- [ ] Fact/brand QA display
- [ ] Human approval queue
- [ ] Gemini usage and cost visibility

## Postponed until justified

- Public signup
- SaaS billing
- Marketplace
- Advanced RBAC
- Automatic publishing everywhere
- Large industry-pack catalog
- Advanced RAG
- Client-facing SaaS dashboard
