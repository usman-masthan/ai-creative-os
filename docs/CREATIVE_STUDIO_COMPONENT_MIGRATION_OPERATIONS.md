# Creative Studio — Component Migration Operations & Recovery

## Purpose

The component migration planner deliberately uses file-backed immutable plans, per-design DesignDocument versions and immutable execution audits. A selected batch is preflighted before persistence, but a process or filesystem interruption can still occur **after one or more design revisions have been saved and before the final execution audit is written**.

The Migration History & Recovery Center reconciles those surfaces instead of pretending a cross-design database transaction exists.

It also provides a governed recovery action that restores pre-migration content as a **new DesignDocument revision**. Historical migration revisions, execution records and approvals are never deleted or rewritten.

## Operational reconciliation

For each stored migration plan and eligible design item, the operational service compares:

- immutable plan item;
- expected source and migration target DesignDocument versions;
- actual DesignProject current version;
- historical target version file;
- migration history summary;
- root `componentInstance` provenance;
- immutable execution audits.

Each item is classified as one of:

```text
PENDING
RECORDED_EXECUTION
PERSISTED_WITHOUT_EXECUTION_AUDIT
STALE_CHANGED
DESIGN_MISSING
AUDIT_INCONSISTENT
```

### PENDING

The design still equals the dry-run source version and the plan item has not been executed.

### RECORDED_EXECUTION

The expected migration DesignDocument revision exists, its component provenance matches the target version, and an immutable execution audit references that exact plan item.

### PERSISTED_WITHOUT_EXECUTION_AUDIT

The expected migration DesignDocument revision exists and contains the planned target component provenance, but no execution audit references the plan item.

This is treated as evidence of an interrupted file-backed execution after design persistence but before execution-audit persistence.

The system reports the condition; it does **not** fabricate a missing execution audit.

### STALE_CHANGED

The design no longer equals the plan source version and there is no verified migration-version evidence for this item. A fresh dry-run is required before migration.

### DESIGN_MISSING

The referenced DesignProject is unavailable.

### AUDIT_INCONSISTENT

An execution audit claims the plan item executed, but the expected historical migration revision/provenance cannot be verified.

This is a fail-closed operational inconsistency and is not silently repaired.

## Per-design migration diff

`DesignVersionService.compare()` is reused to inspect the plan item's source version against its migration target version.

Version comparison includes native visual/editing properties **and `componentInstance` provenance**:

```text
componentId
instanceId
templateLayerId
```

Therefore a component v1 → v2 migration remains visible in Inspect Diff even when the two component versions have identical geometry and styling.

## Recovery model

Recovery is intentionally not rollback.

```text
current DesignDocument vN
+ immutable plan item
+ pre-migration historical source vS
+ current immutable campaign truth
→ recovery preview
→ deterministic QA
→ optional approved-current acknowledgement
→ persist pre-migration content as new vN+1
```

The original source version, migration version and current version remain immutable historical versions.

## Recovery source is plan-bound

The browser cannot request an arbitrary version number to recover.

The server accepts:

- design context;
- immutable migration `planId`;
- immutable migration `itemId`.

It derives `restoreSourceVersion` from the stored plan item's exact source version.

Recovery is allowed only for an item currently classified:

```text
RECORDED_EXECUTION
PERSISTED_WITHOUT_EXECUTION_AUDIT
```

## Current truth and deterministic QA

Recovery does not assume old content is still valid merely because it existed before migration.

Preview reloads the design campaign's current immutable task-truth snapshot and constructs the proposed new revision in memory. `runDesignQa` is executed against that truth.

If deterministic QA returns `BLOCK`, recovery is not restorable and nothing is persisted.

The QA gate is rerun immediately before the save as well.

## Approved current version

Approval remains exact-version-bound.

If the current DesignDocument version is approved:

1. preview reports `currentVersionApproved = true`;
2. recovery requires explicit acknowledgement;
3. the approved version and approval record are left unchanged;
4. recovery creates a new unapproved DesignDocument revision;
5. the new revision must pass the normal visual QA/human-approval flow before production use.

Recovery never moves an approval record from one version to another.

## Recovery preview token

Preview returns a SHA-256 token bound to the proposed recovery state, including:

- plan/item identity;
- current design version;
- recovery source/target versions;
- current approval state;
- operational reconciliation status;
- migration version comparison;
- deterministic QA result;
- proposed recovered document structure/content/provenance.

Restore recomputes preview and rejects a stale token if relevant state changed.

## Recovery audit

Every successful recovery writes an immutable record under:

```text
.atthas-os/components/<clientId>/<brandId>/_migrations/recoveries/<recoveryId>.json
```

The record contains:

- migration plan/item identity;
- design id;
- current version from which recovery was requested;
- historical pre-migration version whose content was restored;
- newly created recovery version;
- whether the current version was approved;
- whether approved-version recovery was explicitly acknowledged;
- deterministic QA decision;
- preview token;
- timestamp.

## Studio UI

The Reusable Components area now includes **Migration History & Recovery** with:

- Refresh Migration History;
- plan-by-plan operational reconciliation;
- explicit persisted-without-audit warnings;
- Inspect Diff;
- Preview Recovery;
- deterministic QA / approval preview;
- Restore Pre-migration Content as New Revision;
- recent recovery audit entries.

## Safety invariants

1. Operational reconciliation is read-only.
2. Reconciliation never fabricates missing execution audits.
3. Historical DesignDocument versions remain immutable.
4. Component provenance is part of migration version diff evidence.
5. Recovery source is derived from the immutable migration plan, not arbitrary client input.
6. Recovery must use current immutable campaign truth.
7. Deterministic QA `BLOCK` prevents recovery persistence.
8. Recovery always creates exactly one new DesignDocument revision.
9. Recovery does not delete, rewrite or move the historical migration revision.
10. Exact-version approvals remain attached to their original versions.
11. Recovery from an approved current version requires explicit acknowledgement and produces a new unapproved version.
12. Recovery preview must be recomputed and token-matched before persistence.
13. Recovery audit records are immutable.
14. Operational reconciliation and recovery add zero AI/model calls.
15. No recovery action changes campaign lifecycle state.

## Non-goals

This phase does not implement:

- database transactions across multiple design files;
- automatic repair/fabrication of a missing execution audit;
- destructive rollback;
- deletion of a migration revision;
- automatic approval transfer;
- automatic publication of a recovered design;
- scheduled recovery;
- automatic retry of an interrupted batch;
- AI-driven recovery decisions.
