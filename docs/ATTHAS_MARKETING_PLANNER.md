# ATTHA’S Marketing Planner V1

The Marketing Planner is the layer above individual campaign generation. It converts a monthly business objective into a deterministic publishing calendar that can later feed each campaign into the Creative Director.

## Flow

`monthly objective → deterministic calendar slots → Gemini marketing strategy → strict validation → truth-readiness classification → campaign queue`

The calendar dates are application-controlled. Gemini does not invent or move publishing dates.

## Default cadence

The planner supports 1–7 posts per week. When explicit weekdays are not supplied, the application assigns a deterministic weekday pattern. For the default three-post cadence this is Tuesday / Thursday / Saturday.

## Campaign types

- `PRODUCT_PUSH`
- `DINE_IN`
- `DELIVERY`
- `BRAND_BUILDING`
- `ENGAGEMENT`
- `SEASONAL`
- `OFFER`

## Truth readiness

The planner is allowed to schedule strategically useful work even when the underlying operational facts are intentionally deferred. It is not allowed to silently turn missing facts into advertising truth.

Each calendar item is normalized by application policy into one of:

- `READY_WITH_CURRENT_TRUTH`
- `NEEDS_TRUTH_BEFORE_PRODUCTION`

Examples:

- Brand-building and generic engagement can proceed without product/price facts.
- Dine-in work requires verified physical branch address and opening hours.
- Product pushes require a verified product name, branch availability and an approved product visual.
- Delivery work requires a verified delivery channel and branch availability.
- Offers require verified terms, validity, price and branch availability.

The AI may suggest `additionalTruthNeeded`, but it cannot remove mandatory requirements defined by the application.

## Branch safety

The planner receives the owner-confirmed ATTHA’S branch catalog. A calendar item can be `BRAND_WIDE` or use one exact branch ID. Branch IDs are validated against the chosen operating brand, so a Restaurant branch cannot be attached to a Burger campaign and vice versa.

## Internal planning only

`conceptDirection` is an internal strategic direction, not final ad copy. The validator blocks customer-facing price/offer claims such as LKR amounts, percentage-off statements or Buy 1 Get 1 language inside planner directions. Final factual copy still goes through the normal campaign fact gate and Creative Director workflow.

## Output

The validated monthly plan contains:

- north-star strategy
- strategic objectives
- audience priorities
- weighted content pillars
- monthly campaign-type balance
- weekly focus plans
- one calendar entry per deterministic slot
- channel and asset type
- operating brand and branch scope
- campaign type and priority
- truth requirements, missing truth and readiness
- planning notes

## Demo

```bash
npm run marketing:plan-demo
```

Optional environment variables:

```bash
MARKETING_PLAN_MONTH=2026-09
MARKETING_POSTS_PER_WEEK=3
MARKETING_OBJECTIVES="Grow awareness|Increase dine-in consideration"
```

The demo uses the Gemini `creative` text role and reads the owner-confirmed branch master plus ATTHA’S brand rules from the repository.

## Current deferred truth remains deferred

This planner does not bypass the current sprint decision to postpone:

- dine-in/takeaway prices
- Uber prices
- PickMe prices
- complete ingredients/descriptions
- allergens
- offers/validity dates
- product availability by branch
- real product photographs/rights/SKU mapping

Those facts can be planned around, but production remains blocked where they are required.
