# ATTHA'S — T001

Tenant ID: `T001`

ATTHA'S is modeled as one master brand with two operating brand families:

- `ATTHAS_RESTAURANT` — ATTHA'S Restaurant / Authentic Multi Cuisine
- `ATTHAS_BURGER` — ATTHA'S Burger

## Public-repository rule

This repository may contain **public-safe, source-backed facts and rebrand proposals only**. Never commit credentials, unpublished commercial information, private customer data, private staff information, beneficiary information, or private client assets.

## Truth statuses

- `VERIFIED` — explicitly confirmed as official/current by the brand owner or an approved internal source.
- `OWNER_SOURCE_CONFIRMED` — supplied directly by the owner/client, but may still be historical or channel-specific.
- `SOURCE_VERIFIED` — observed from a named public source such as Uber Eats.
- `CONFLICT_REQUIRES_CONFIRMATION` — trustworthy sources disagree; do not publish this fact.
- `MISSING` — not available.

`SOURCE_VERIFIED` facts may be used for explicitly source-specific campaigns (for example, an Uber Eats campaign), but do not silently promote them to the official master truth.

## Structure

```text
brands/
  master/
  restaurant/
  burger/
rebrand/
truth/
  menu/
  pricing/
  business.json
  branches.json
  contacts.json
  delivery.json
  social.json
  offers.json
  conflicts.json
  sources.json
assets/
campaigns/
```
