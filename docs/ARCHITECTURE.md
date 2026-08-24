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

The system separates information into three classes.

### Verified truth

Customer-facing facts that must not be invented include prices, offers, product/project names, dates, locations, phone numbers, opening hours, availability, donation information, and beneficiary/impact statistics.

Missing required truth becomes `MISSING_VERIFIED_DATA`.

Truth carries provenance status: `VERIFIED`, `OWNER_SOURCE_CONFIRMED`, `SOURCE_VERIFIED`, `CONFLICT_REQUIRES_CONFIRMATION`, or `MISSING`.

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

## 5. Cost-conscious generation ladder

```text
Routine strategy/copy — Gemini 3.5 Flash Lite
  ↓
Up to 3 concepts
  ↓
Creative escalation only when justified — Gemini 3.6 / 3.7
  ↓
Deep/sensitive review only when justified — Gemini 3.1 Pro
  ↓
Selected concept
  ↓
Nano Banana 2 Lite draft
  ↓
QA + concept approval
  ↓
Nano Banana 2 production image
  ↓
Nano Banana Pro only when premium escalation is justified
  ↓
Deterministic factual overlay
  ↓
Human approval when required
  ↓
Veo only after static direction approval
```

## 6. Gemini-only provider architecture

Creative OS uses a single provider family: **Google Gemini**.

```text
Creative OS
   ↓
Google Gemini API
   ├─ gemini-3.5-flash-lite          routine / bulk
   ├─ gemini-3.6-flash               creative director
   ├─ gemini-3.7-flash               advanced Flash
   ├─ gemini-3.1-pro-preview         deep / sensitive review
   ├─ gemini-3.1-flash-lite-image    draft image
   ├─ gemini-3.1-flash-image         production image
   ├─ gemini-3-pro-image             premium image
   ├─ gemini-3.1-flash-tts-preview   TTS
   └─ Veo 3.1 Lite / Fast / Premium  video
```

Canonical model IDs live in `src/providers/geminiModels.ts`. Runtime escalation policy lives in `src/providers/geminiPolicy.ts`. Operational configuration lives in `config/providers.json`.

There is no OpenRouter, Groq, OpenAI, Anthropic, getimg.ai, or Runway provider in the active architecture.

## 7. Paid media safety

Billing is enabled, but paid media is never treated as free or automatic.

- `ALLOW_PAID_MEDIA=true` is required before demo commands intentionally call a paid media model.
- draft images are the default paid visual step
- production images require an approved concept through policy guards
- premium images require an explicit premium override
- all Veo roles require an approved static direction
- premium Veo requires an explicit premium override
- deterministic text/price/CTA overlays remain outside image generation

This separates **model access** from **permission to spend**.

## 8. Usage and cost telemetry

Provider responses expose usage where available. Creative OS records token counts, service tier and estimated cost using a versioned pricing snapshot (`2026-08-13`). Image/video providers also expose output-cost estimates based on selected model, resolution and duration.

These estimates are observability aids, not invoices. Google billing remains the source of truth, and the pricing snapshot must be updated when provider pricing changes.

## 9. Media providers

### Image

`GeminiImageProvider` uses the Gemini Interactions API and receives inline base64 image data. `producePoster()` persists the image locally and then renders factual copy through deterministic HTML/CSS.

### TTS

`GeminiTtsProvider` returns 24 kHz, mono, 16-bit PCM audio data plus usage telemetry when available.

### Video

`GeminiVeoProvider` submits Veo long-running generation jobs, polls until completion, downloads the resulting MP4, and estimates cost from model/resolution/duration.

## 10. Future persistence

When persistence is added, prefer:

- PostgreSQL/Supabase for structured campaign/tenant metadata
- Cloudflare R2 or equivalent for media/object storage
- n8n for lightweight orchestration where appropriate

The repository should keep tenant IDs, campaign IDs, prompt versions, Gemini model roles, and workflow contracts stable enough to migrate into a later application.
