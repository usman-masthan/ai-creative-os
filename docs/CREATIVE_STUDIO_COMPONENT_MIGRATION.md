# Creative Studio — Impact-Aware Component Migration

## Purpose

Dependency impact analysis explains what a reusable-component change would affect. Migration planning turns that read-only evidence into a deliberate, auditable upgrade workflow without reintroducing live-linked master components or silent bulk mutation.

The migration planner is intentionally explicit:

```text
Impact analysis
→ immutable dry-run plan
→ user chooses eligible designs
→ all selected designs revalidated in memory
→ one governed DesignDocument revision per design
→ deterministic QA per design
→ immutable execution audit
```

No migration action invokes an AI model.

## Dry-run plan

A migration plan is created only for an `ACTIVE` component family and one immutable target component version from that family.

The planner reruns dependency impact analysis and splits current attached family instances into two categories.

### Eligible

An instance is eligible only when:

- governance is `EDITABLE`;
- upgrade readiness is `UPGRADEABLE`;
- the instance belongs to the selected client + brand family;
- the analyzed target version is strictly newer than the attached version;
- destination truth and native text-role requirements already pass governed impact simulation.

Eligible instances are grouped by DesignDocument. This is important: one design can contain more than one eligible component instance, but a migration item represents the **design transition**, not a sequence of unrelated instance saves.

Each eligible design item records:

- design id;
- campaign id;
- exact source DesignDocument version;
- proposed target DesignDocument version (`source + 1`);
- every planned instance id/root group/current component version;
- target component/version;
- a design-specific `preconditionToken`.

### Excluded

The plan explicitly records every family instance that is not eligible, including:

- `FROZEN_APPROVED` exact current design versions;
- `CURRENT_TARGET` instances;
- `BLOCKED_TRUTH`;
- `BLOCKED_TEXT_ROLE`;
- `BLOCKED_VERSION`;
- `BLOCKED_STRUCTURE`.

Excluded instances are not silently omitted. Their governance/readiness state and reason remain visible in the plan and Studio UI.

## Immutability

Plans are stored under:

```text
.atthas-os/components/<clientId>/<brandId>/_migrations/plans/<planId>.json
```

The plan id includes family, target version and the dependency-impact hash prefix. Saving the same plan id with different content is rejected.

A plan also carries:

- the source dependency `impactToken`;
- a deterministic `planToken` over the plan's governed content;
- per-design precondition tokens.

The API never executes a client-supplied plan object. Execution accepts only a stored `planId`, expected plan token and selected design item ids.

## Design-level execution

The user may execute one eligible design or any selected subset of eligible designs from the same immutable plan.

Before the first selected design is saved, **every selected design is fully preflighted**.

For each selected design the server verifies:

1. the exact current DesignDocument version still equals the planned source version;
2. the exact current version has not become approved;
3. every planned root component instance still exists;
4. every planned instance still points to the same component family/version recorded in the plan;
5. the target component remains a valid immutable version in an `ACTIVE` family;
6. the recomputed design precondition token still matches;
7. destination immutable task truth is still available;
8. governed component replacement succeeds for every planned instance;
9. deterministic DesignDocument validation succeeds;
10. deterministic design QA does not return `BLOCK`.

If any selected design fails preflight, the selected batch is rejected before migration persistence begins.

## One revision per design

A design may contain several eligible instances. Their replacements are calculated sequentially **in memory**, but intermediate component-upgrade history revisions are discarded.

The final migrated document is collapsed to:

```text
source DesignDocument vN
→ migration result vN+1
```

with one human migration history record listing the migrated instance ids and target component version.

The resulting design is saved once and deterministic QA is persisted once.

This preserves the invariant:

> one selected design migration action → one DesignDocument revision + one deterministic QA result.

## Independent execution from one plan

Design preconditions are intentionally per-design rather than one global execution token.

This allows a user to:

```text
create one dry-run plan
→ migrate Design A
→ later migrate Design B from the same plan
```

provided Design B itself has not changed since planning.

Migrating Design A changes the repository-wide dependency picture, but it does not invalidate Design B's independent plan-time precondition automatically.

If Design B is edited, approved, upgraded, detached or otherwise changes its planned dependency state, its precondition fails and a fresh dry-run plan is required for that design.

## Approved designs

`FROZEN_APPROVED` instances never enter the eligible migration set.

Even if the target version is technically upgradeable, an approved exact current DesignDocument is represented only as an exclusion. Migration planning and execution do not invalidate the approval, clone the design or create a revision automatically.

Any future workflow for intentionally revising an approved creative must be a separate explicit governance flow.

## Batch semantics

Selected-batch migration is not a database transaction, but it follows a two-phase safety pattern:

```text
Phase 1: prepare every selected design in memory + run QA
Phase 2: save the already-prepared design revisions + QA records
```

Therefore ordinary stale/truth/role/component/QA failures are caught before the first save.

Unexpected filesystem/process failures during Phase 2 are outside the scope of this file-backed Stage-1 store and would require a transactional persistence backend for true cross-design atomic commit semantics.

## Execution audit

Successful execution writes an immutable audit record under:

```text
.atthas-os/components/<clientId>/<brandId>/_migrations/executions/<executionId>.json
```

The record contains:

- plan id;
- family id;
- target component/version;
- exact selected plan item ids;
- each migrated design id;
- source and resulting DesignDocument versions;
- migrated instance ids;
- deterministic QA decision;
- execution timestamp.

Execution records never rewrite the immutable plan.

## Studio UI

The Reusable Components → Dependency Impact panel now contains **Migration Planner**.

The user can:

- choose component family/version;
- create an immutable dry-run migration plan;
- review eligible design version transitions;
- review explicit frozen/blocked exclusions;
- uncheck any eligible design;
- execute only the selected design migrations;
- see the currently open design refresh only when that design was actually migrated.

After execution the browser discards the active plan and requires a new dry-run before additional migration work.

## API

```text
POST /api/studio/components/migration-plan
GET  /api/studio/components/migration-plan?designId=<id>&planId=<id>
POST /api/studio/components/migration-execute
```

Execution requires:

```text
planId
expectedPlanToken
selectedItemIds[]
```

The server reloads the immutable plan from storage before execution.

## Safety invariants

1. Only `EDITABLE + UPGRADEABLE` instances may become migration candidates.
2. Approved/frozen instances must remain explicit exclusions.
3. Blocked instances must remain explicit exclusions with their diagnostic reason.
4. A plan is immutable and cannot be replaced under the same id with changed content.
5. The browser cannot submit a fabricated plan object for execution.
6. Every selected design must still match its exact source version and instance provenance.
7. A design that becomes approved after planning must fail execution.
8. Destination immutable task truth must be loaded again at execution.
9. Governed component replacement must be reused; migration may not use a weaker copy/patch path.
10. All selected designs must pass preflight before the first selected design is saved.
11. Every migrated design receives exactly one new DesignDocument revision.
12. Every migrated design reruns deterministic QA; `BLOCK` prevents persistence.
13. Existing non-selected eligible designs remain unchanged.
14. Frozen/blocked exclusions remain unchanged.
15. Migration planning and execution add zero AI/model calls.
16. No component instance is live-linked or automatically upgraded.

## Non-goals

This phase does not implement:

- automatic migration of every eligible design;
- migration of approved/frozen designs;
- automatic truth collection for blocked designs;
- automatic creation of missing text roles;
- automatic approval invalidation;
- transactional database semantics across several design saves;
- scheduled/background migrations;
- cross-client or cross-brand migrations.
