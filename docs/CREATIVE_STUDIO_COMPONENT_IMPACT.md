# Creative Studio — Component Dependency Impact Analysis

## Purpose

Reusable components are immutable and do not live-update existing designs. Once component families have versions and lifecycle states, designers still need to know what a lifecycle or semantic contract change would affect before they make it.

Dependency impact analysis is a **read-only preflight** over current Creative Studio state. It never updates a DesignDocument, never upgrades an instance, and never invokes an AI model.

## What is scanned

For one client+brand-scoped component family and one target component version, Creative Studio scans every current DesignProject and finds attached root component instances whose immutable `componentId` belongs to that family.

For every affected current design it records:

- design id and exact current DesignDocument version;
- campaign id;
- instance id and root group id;
- attached immutable component id/version;
- analyzed target component id/version;
- whether the exact current design version has a stored human approval;
- missing destination confirmed-truth keys;
- missing or ambiguous native destination text roles;
- the result of an in-memory governed component upgrade simulation.

## Governance states

```text
EDITABLE
FROZEN_APPROVED
```

`FROZEN_APPROVED` means the exact current DesignDocument version has a version-bound human approval record. The impact analyzer may still report that the target is technically upgradeable, but the approved design is deliberately described as frozen. No lifecycle, authoring or analysis action mutates it automatically.

## Upgrade readiness

```text
CURRENT_TARGET
UPGRADEABLE
BLOCKED_TRUTH
BLOCKED_TEXT_ROLE
BLOCKED_VERSION
BLOCKED_STRUCTURE
```

`UPGRADEABLE` means the same governed in-memory replacement path used by explicit instance upgrades succeeds against the design's current immutable task truth and native role contract.

`BLOCKED_TRUTH` identifies destination campaigns that do not currently contain the target version's required confirmed truth.

`BLOCKED_TEXT_ROLE` identifies destination designs that cannot uniquely rebind one or more target text roles from native destination text layers.

`BLOCKED_VERSION` prevents interpreting an equal or older target as an upgrade.

`BLOCKED_STRUCTURE` catches missing component definitions or another governed replacement failure not represented by the earlier diagnostic categories.

## Impact token

Every report receives a SHA-256 `impactToken` derived from:

- family identity/state;
- analyzed target version and sanitized component structure;
- every affected current design id/version;
- current attached instance versions;
- approval/freeze state;
- truth/role diagnostics;
- upgrade-simulation results.

`generatedAt` is intentionally not part of the token.

If a dependent design changes version, approval state changes, an instance is upgraded/detached, the target component changes, or another relevant dependency changes, a newly computed impact token changes.

This makes the impact report usable as mutation preflight evidence rather than an informational screenshot.

## Lifecycle guard

Deprecating or archiving a component family is now guarded:

```text
Analyze latest family version impact
→ inspect affected designs / blockers / approved frozen instances
→ obtain current impactToken
→ explicit user confirmation
→ POST lifecycle change with impactToken
→ server recomputes impact
→ token must match
→ lifecycle metadata may change
```

Reactivate does not require an impact token because it does not invalidate or mutate an existing instance.

Changing lifecycle state still changes only family metadata. Existing designs remain untouched.

## Semantic component authoring guard

An authored next version with compatibility `REVIEW_REQUIRED` already requires structural/truth review. It now also performs dependency impact analysis using the **sanitized candidate component before that candidate is persisted**.

Preview therefore returns:

- authoring structural/truth diff;
- authoring preview token;
- existing-family dependency impact report;
- candidate impact token.

Publish recomputes both authoring preview and candidate impact. A semantic version cannot publish unless both tokens still match and the user explicitly acknowledged the review.

Geometry/style-only `COMPATIBLE` authoring does not require the additional family scan because its semantic slot/truth contract is unchanged.

## Studio UI

The Reusable Components panel exposes **Dependency Impact** with:

- Analyze Selected Version Impact;
- total affected designs and instances;
- technically upgradeable instances;
- blocked instances;
- approved/frozen instances;
- per-design/current-version rows;
- missing truth keys;
- missing/ambiguous native text roles;
- upgrade-simulation reason.

Deprecate and Archive are intercepted by this layer and run a fresh latest-version analysis before sending the lifecycle mutation.

Semantic component authoring shows candidate impact totals directly inside the version preview before explicit publish.

## Safety invariants

1. Impact analysis is read-only and must never create a DesignDocument revision.
2. Impact analysis adds zero model calls.
3. Approval is evaluated against the exact current DesignDocument version.
4. An approved current design is never auto-upgraded or auto-detached.
5. Upgradeability is evaluated using current destination task truth and native role bindings, not source component truth.
6. Deprecate/Archive require a freshly recomputed matching impact token.
7. `REVIEW_REQUIRED` component authoring requires a freshly recomputed matching candidate-impact token.
8. Existing instances remain bound to their exact immutable component ids until an explicit governed upgrade/detach action occurs.

## Non-goals

Impact analysis does not:

- mass-upgrade affected designs;
- automatically fix missing truth;
- automatically create missing native role layers;
- invalidate old approvals by itself;
- mutate campaign lifecycle state;
- turn component families into live-linked master objects;
- invoke AI to decide compatibility.
