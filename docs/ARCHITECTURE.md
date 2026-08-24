# Architecture

## 1. Purpose

AI Creative OS is initially an internal, lean operating system for three clients. It is not yet a public multi-tenant SaaS product.

The architecture preserves the boundaries needed for a later SaaS migration without paying for that complexity now.

## 2. Core operating model

Every task resolves the following context before creative work begins:

```text
TENANT
BRAND
CAMPAIGN
OBJECTIVE
CHANNEL
ASSET TYPE
```

The system then separates information into three classes.

### Verified truth

Customer-facing facts that must not be invented include prices, offers, product/project names, dates, locations, phone numbers, opening hours, availability, donation information, and beneficiary/impact statistics.

Missing required truth becomes `MISSING_VERIFIED_DATA`.

Truth also carries provenance status: `VERIFIED`, `OWNER_SOURCE_CONFIRMED`, `SOURCE_VERIFIED`, `CONFLICT_REQUIRES_CONFIRMATION`, or `MISSING`.

### Brand rules

Constraints such as logo use, colors, typography, visual direction, tone, CTA style, spacing, and prohibited treatments.

### Creative freedom

Campaign concepts, hooks, layouts, storytelling angles, visual metaphors, scripts, motion ideas, lighting, composition, and other creative choices may be generated as long as verified truth is not altered.

## 3. Tenant isolation

Tenant context is a hard boundary. Content, assets, facts, products, prices, history, colors, tone, and organizational information must never leak across tenants.

Initial tenants:

- `T001` — ATTHA'S
- `T002` — SKK Meat Goodies
- `T003` — Lifeline Association Sri Lanka

## 4. Risk tiers

- Commercial routine content: normal factual + brand QA.
- Major promotions/campaign direction: human approval.
- Lifeline humanitarian/beneficiary content: stricter factual, ethical, consent, and reputational review.

## 5. Generation ladder

```text
Strategy
  ↓
Up to 3 concepts
  ↓
AI critique/ranking
  ↓
Strongest concept
  ↓
Low-cost draft visual
  ↓
QA
  ↓
Final concept
  ↓
Premium image if justified
  ↓
Human approval when required
  ↓
Video only when necessary
```

## 6. Gemini-only provider architecture

Creative OS uses a single provider family: **Google Gemini**.

This removes provider-routing complexity and keeps one API-key/SDK surface while still allowing different model classes for different jobs.

```text
Creative OS
   ↓
Google Gemini API
   ├─ gemini-3.5-flash-lite      default / bulk
   ├─ gemini-3.6-flash           creative director
   ├─ gemini-3.7-flash           optional latest Flash
   ├─ gemini-3.1-pro-preview     paid deep review
   ├─ Nano Banana models         paid image generation
   ├─ Gemini Flash TTS           voice
   └─ Veo 3.1 models             paid video
```

The canonical model IDs live in `src/providers/geminiModels.ts`. Operational role selection lives in `config/providers.json`.

There is no OpenRouter, Groq, OpenAI, Anthropic, getimg.ai, or Runway provider in the active architecture.

## 7. Free vs paid phase

The current development project uses Gemini free-tier text models. Paid-only media and Pro models are present in configuration so the architecture does not need to be redesigned later, but they should not be invoked until billing is intentionally enabled.

Free-phase poster rendering therefore accepts an existing local base image and keeps factual text in the deterministic HTML/CSS overlay.

## 8. Future persistence

When persistence is added, prefer:

- PostgreSQL/Supabase for structured campaign/tenant metadata
- Cloudflare R2 or equivalent for media/object storage
- n8n for lightweight orchestration where appropriate

The repository should keep tenant IDs, campaign IDs, prompt versions, Gemini model roles, and workflow contracts stable enough to migrate into a later application.
