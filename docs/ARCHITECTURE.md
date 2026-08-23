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

The system then separates information into three classes:

### Verified truth

Customer-facing facts that must not be invented:

- prices
- offers
- product/project names
- dates
- locations
- phone numbers
- opening hours
- availability
- donation information
- beneficiary/impact statistics

Missing required truth becomes `MISSING_VERIFIED_DATA`.

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

This prevents expensive models from being used during routine brainstorming.

## 6. Provider abstraction

Provider choice belongs behind capability roles rather than being hard-coded into campaign logic.

Current intended roles:

- Strategy/orchestration: ChatGPT
- Independent critique: Claude when needed
- Draft image generation: getimg.ai
- Premium image generation: Nano Banana Pro / Google image model
- Routine video: Runway
- Premium cinematic video: Google Veo

## 7. Future persistence

When persistence is added, prefer:

- PostgreSQL/Supabase for structured campaign/tenant metadata
- Cloudflare R2 or equivalent for media/object storage
- n8n for lightweight orchestration where appropriate

The repository should keep tenant IDs, campaign IDs, prompt versions, provider roles, and workflow contracts stable enough to migrate into a later application.
