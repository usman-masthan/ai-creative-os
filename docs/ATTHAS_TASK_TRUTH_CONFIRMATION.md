# ATTHA’S Task Truth Confirmation

## Purpose

Creative OS must not force ATTHA’S to fully populate every menu, price, offer, ingredient, availability and image record before the system can be useful.

Instead, V1 uses **just-in-time truth acquisition**:

> A user gives the business task. Creative OS determines the exact customer-facing facts required for that task, retrieves any stored values, asks the user to confirm every one of them, asks for anything missing/conflicting, and creates an immutable task-scoped truth snapshot before AI production begins.

Stored truth is memory. A task confirmation is permission to use that truth now.

## Hard rule

For the canonical user-facing production path:

`stored truth -> task questionnaire -> explicit user confirmation/input -> immutable task snapshot -> fact gate -> creative production`

Never:

`stored truth -> automatic customer-facing reuse`

This applies even when a stored fact has status `VERIFIED` or `OWNER_SOURCE_CONFIRMED`.

## Task-specific questions

Creative OS does not ask for the complete ATTHA’S database on every job. It asks only for facts required by the current campaign type and any extra task requirements.

Examples:

- `BRAND_BUILDING`: no additional operational fact may be necessary.
- `DINE_IN`: confirm physical address and physical opening hours for the branch.
- `PRODUCT_PUSH`: confirm/provide product identity, branch availability and approved product visual.
- `DELIVERY`: confirm/provide delivery channel and branch availability.
- `SEASONAL`: confirm/provide the seasonal context being claimed.
- `OFFER`: confirm/provide offer terms, validity, price and branch availability.

The planner remains responsible for deriving `requiredTruth`. The confirmation layer converts every requirement into one of three question types:

- `CONFIRM_STORED` — a usable stored value exists, but the user must confirm or correct it.
- `PROVIDE_MISSING` — no usable stored value exists; the user provides it for this task.
- `RESOLVE_CONFLICT` — stored records conflict; the user provides the current task value.

## Branch / product / channel isolation

A fact is not just `price = 1150`.

A price is scoped:

`tenant -> brand -> branch -> product -> sales channel`

For example, the same Beef Cheese Burger can legitimately have:

- Wellampitiya dine-in: LKR 1,150
- Bambalapitiya dine-in: LKR 1,200
- Kollupitiya dine-in: LKR 1,150
- Wellampitiya Uber Eats: another value

Creative OS must never inherit a branch/channel price from another scope.

Even if several branches currently have the same value, branch-specific requirements remain separate confirmations. A future UI may offer a convenience action such as “same price at these branches”, but that action must expand into separately scoped confirmed facts after explicit user confirmation.

## Task snapshot

After the user answers all questions, Creative OS creates `TaskTruthSnapshot` containing:

- campaign/session identity
- who confirmed it
- when it was confirmed
- one exact scoped value per required fact
- whether each value was confirmed, provided or replaced
- prior stored value/source when applicable
- whether the user requested a master-truth write-back

The task snapshot is immutable for that production attempt.

## Corrections

If stored truth says `Rs. 1,150` and the user says `Rs. 1,250`:

1. The current task snapshot uses `Rs. 1,250`.
2. Stored truth is not silently overwritten.
3. The confirmation can record whether the user wants the correction written back to the master truth store.
4. Governed persistent write-back is separate from task production.

This prevents a temporary price/offer/availability change from accidentally becoming permanent global truth.

## Canonical user-facing API

Use:

- `prepareConfirmedCampaignTask(...)` to build the task questionnaire.
- `answerConfirmedCampaignTask(...)` to create the immutable snapshot.
- `runConfirmedCampaignTask(...)` as the canonical user-facing production gateway.

`runConfirmedCampaignTask` behaves in two phases:

1. Without a snapshot it returns `TASK_CONFIRMATION_REQUIRED` and does not call AI production.
2. With a valid snapshot it replaces stored truth with ephemeral `TASK_CONFIRMATION:<session>` records and runs the existing governed production pipeline.

The lower-level `producePlannedCampaign(...)` command remains an internal production primitive. Product/UI entry points should go through the confirmation gateway.

## Safety properties

- Stored values are never silently reused by the user-facing gateway.
- Every required fact must be answered.
- Unexpected answers are rejected.
- Duplicate requirement scopes are rejected.
- Snapshot campaign/tenant/brand/branch drift is rejected.
- A brand-wide task cannot silently consume an arbitrary branch-scoped truth record.
- Explicit branch requirements only match records from that branch.
- Production gets only the confirmed snapshot records, not the mutable stored truth collection.

## Demo

Run:

```bash
npm run truth:task-demo
```

The demo shows two identical stored prices at different branches and still creates separate confirmation questions, plus a missing branch-availability question. It then creates the task snapshot and the ephemeral production truth records.

## Next UI layer

The eventual marketing-manager UI should render the questionnaire in one grouped form, for example:

```text
I need these details before producing this campaign:

1. Beef Cheese Burger available at Wellampitiya?
   [ Yes ] [ No ]

2. Stored Wellampitiya dine-in price: Rs. 1,150
   [ Confirm ] [ Change ]

3. Stored Bambalapitiya dine-in price: Rs. 1,150
   [ Confirm ] [ Change ]

4. Product visual
   [ Use approved image ] [ Upload image ] [ Other ]

[ Confirm and Continue ]
```

The UI must never hide which scope a price, offer, availability or product fact belongs to.
