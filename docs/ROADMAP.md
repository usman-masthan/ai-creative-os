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
- [ ] Add explicit Creative Director invocation using `gemini-3.6-flash`
- [ ] Add optional `gemini-3.7-flash` escalation with availability fallback
- [ ] Add free-tier quota-aware request budgeting
- [ ] Add retry budgets and stop conditions for 429/503 errors
- [ ] Add prompt/output usage logging

## Phase 3 — Paid Gemini media

Enable only after billing is deliberately turned on.

- [ ] Add Nano Banana 2 Lite draft-image adapter
- [ ] Add Nano Banana 2 production-image adapter
- [ ] Add Nano Banana Pro premium-image adapter
- [ ] Add Gemini 3.1 Flash TTS adapter
- [ ] Add Veo 3.1 Lite video adapter
- [ ] Add Veo 3.1 Fast video adapter
- [ ] Add Veo 3.1 premium video adapter
- [ ] Add cost estimation and per-campaign media budgets
- [x] Deterministic HTML/CSS poster renderer
- [x] Deterministic factual overlays

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
