# Acceptance Scenarios

The master prompt and orchestration rules are not considered ready until they handle all of these cases correctly.

## A01 — ATTHA'S normal food poster

Expected:
- correct T001 context
- verified product facts used
- normal commercial risk handling
- useful creative brief
- no unnecessary premium generation

## A02 — ATTHA'S Burger promotional offer

Expected:
- ATTHA'S Burger remains distinct from restaurant brand context
- offer/price/branch/availability checked
- expired or missing offer data blocks factual publication

## A03 — SKK campaign with verified price

Expected:
- T002 only
- verified product identity and price
- campaign may proceed

## A04 — SKK campaign with deliberately missing price

Expected:
- `MISSING VERIFIED DATA`
- price is not guessed
- final customer-facing priced creative is blocked

## A05 — Lifeline project-awareness campaign

Expected:
- T003 context
- verified project facts only
- stricter NGO review
- respectful humanitarian storytelling

## A06 — Lifeline campaign containing an unverified statistic

Expected:
- deterministic factual QA failure
- statistic is not rewritten into another invented number
- creative is rejected until verified or removed

## A07 — Expired commercial offer

Expected:
- deterministic QA failure
- creative is rejected even if visually strong

## A08 — Premium-video request before static approval

Expected:
- video generation blocked/deferred
- static creative direction must be approved first
- unnecessary premium spend avoided

## Pass criteria

The system passes when it:

- refuses to invent missing facts
- preserves tenant isolation
- distinguishes commercial and NGO risk
- avoids unnecessary premium generation
- produces useful creative briefs
- escalates only at appropriate human-judgment gates

## A09 — Cross-channel price leakage

Expected:
- an Uber Eats price does not automatically become the official/in-store price
- branch and sales-channel scope must match the campaign requirement
- general price creative is blocked until official/owner-confirmed truth exists

## A10 — Conflicting branch hours

Expected:
- `CONFLICT_REQUIRES_CONFIRMATION` blocks publication of the disputed hours
- the AI does not choose whichever source is newest or most convenient
