# AI Creative Studio — Stage 1 Migration Operations Acceptance Addendum

This addendum extends `CREATIVE_STUDIO_STAGE1_ACCEPTANCE.md`, `CREATIVE_STUDIO_STAGE1_COMPONENT_IMPACT_ACCEPTANCE.md` and `CREATIVE_STUDIO_STAGE1_COMPONENT_MIGRATION_ACCEPTANCE.md` for the migration operational-history and governed-recovery phase on `layered-architecture`.

PR #51 remains a draft CI surface only and must not be merged into `main` without explicit approval.

## Acceptance matrix addendum

| Capability | Status | Acceptance evidence |
| --- | --- | --- |
| Migration operational history | PASS | `/api/studio/components/migration-history` reconciles immutable migration plans and execution audits against current DesignProject state and historical version files. |
| Interrupted file-backed batch detection | PASS | A verified migration target revision with matching component provenance but no execution audit is explicitly classified `PERSISTED_WITHOUT_EXECUTION_AUDIT`; no missing audit is fabricated. |
| Migration audit inconsistency detection | PASS | An execution audit whose expected historical migration revision/provenance is unavailable is classified `AUDIT_INCONSISTENT` rather than accepted silently. |
| Per-design migration diff | PASS | Migration History uses `DesignVersionService.compare` over exact plan source/target versions. Version comparison now includes `componentInstance` provenance, so immutable component-version changes remain visible even when geometry/style are identical. |
| Plan-bound recovery source | PASS | Recovery accepts stored migration plan/item identity and derives the pre-migration source version server-side; browser callers cannot choose an arbitrary rollback version. |
| Recovery preview guard | PASS | Preview binds current version, approval state, operational status, migration diff, current-truth deterministic QA and proposed recovered document state into a SHA-256 token. |
| Current-truth recovery QA | PASS | Pre-migration content is reconstructed in memory against the current campaign's immutable task truth and `runDesignQa`; `BLOCK` prevents persistence. QA reruns immediately before save. |
| Non-destructive recovery | PASS | Recovery preserves all historical versions and creates the pre-migration content as one new `vN+1` DesignDocument revision with explicit recovery history. |
| Approved-version recovery acknowledgement | PASS | If the exact current version is approved, recovery requires explicit acknowledgement. The old approval/version remain untouched and the new recovered revision remains unapproved. |
| Immutable recovery audit | PASS | Successful recovery persists plan/item identity, source/current/recovery versions, approval acknowledgement, QA decision, preview token and timestamp under `_migrations/recoveries`. |
| Operational recovery cost discipline | PASS | Reconciliation, version comparison, hashing, truth loading, deterministic QA and recovery persistence add zero AI/model calls. |

## Required safety invariants

Stage 1 migration operations are not accepted if any of the following regress:

1. Operational history must remain client+brand scoped.
2. Reconciliation must not mutate DesignDocuments, component definitions, plans, execution audits, approvals or campaign lifecycle state.
3. Only root component-instance provenance and verified historical DesignDocument evidence may establish migration persistence.
4. `PERSISTED_WITHOUT_EXECUTION_AUDIT` must be reported, not silently converted into a fabricated success audit.
5. An execution audit without matching migration-version evidence must fail closed as `AUDIT_INCONSISTENT`.
6. Generic DesignDocument comparison must include `componentInstance` provenance.
7. Recovery may only target an immutable migration plan item that has verified migration persistence evidence.
8. Recovery source version must come from the stored plan item.
9. The client may not provide an arbitrary recovery source version or direct recovery document payload.
10. Recovery preview must load the current DesignDocument and current immutable campaign truth.
11. Deterministic QA `BLOCK` must make recovery non-restorable.
12. Recovery preview evidence must be SHA-256 bound and recomputed before persistence.
13. A changed current design version or relevant recovery state must invalidate prior preview evidence.
14. Recovery must create exactly one new DesignDocument revision.
15. Recovery must never rewrite/delete the original source, migration or later historical versions.
16. Current-version approval must be checked exactly by design id + version.
17. Approved-current recovery must require explicit acknowledgement.
18. The historical approval record must remain attached to the old approved version.
19. A recovered new revision must not inherit old approval automatically.
20. The recovered revision must persist deterministic QA.
21. Recovery audits must be immutable.
22. Migration operational history and recovery must add zero AI/model calls.

## Operational reconciliation state machine

```text
client + brand migration storage
→ load immutable plans
→ load immutable execution audits
→ for each planned eligible design item:
   read current DesignProject state
   read historical planned migration target version if present
   verify migration history entry
   verify root componentInstance target provenance
   find execution audits referencing item
→ classify:
   PENDING
   RECORDED_EXECUTION
   PERSISTED_WITHOUT_EXECUTION_AUDIT
   STALE_CHANGED
   DESIGN_MISSING
   AUDIT_INCONSISTENT
→ render read-only Migration History & Recovery center
```

## Recovery state machine

```text
Selected verified migrated plan item
→ derive pre-migration source version from immutable plan
→ load current DesignDocument
→ load exact current approval state
→ load current immutable task truth
→ reconstruct pre-migration content as proposed current+1 revision in memory
→ compare original source vs migration target versions
→ run deterministic QA
→ hash recovery preview state
→ QA BLOCK: stop
→ if current exact version approved: require explicit acknowledgement
→ restore request carries planId + itemId + previewToken + acknowledgement
→ server recomputes preview
→ stale token/state: reject
→ rerun deterministic QA
→ save one new DesignDocument revision
→ save QA
→ persist immutable recovery audit
→ old source/migration/current versions and approvals remain unchanged
```

## Regression evidence

- `tests/creativeStudioComponentMigrationOperations.test.ts`
- `tests/creativeStudioComponentMigrationOperationsUi.test.ts`
- `tests/creativeStudioComponentMigration.test.ts`
- `tests/creativeStudioVersions.test.ts`
- all existing dependency-impact, lifecycle, authoring and Studio inline-script tests remain under repository-wide `npm run check`.

## Persistence

```text
.atthas-os/components/<clientId>/<brandId>/_migrations/plans/<planId>.json
.atthas-os/components/<clientId>/<brandId>/_migrations/executions/<executionId>.json
.atthas-os/components/<clientId>/<brandId>/_migrations/recoveries/<recoveryId>.json
```

## Deferred behavior

This phase intentionally does not implement cross-design transactions, automatic retry/completion of interrupted batches, automatic audit repair, destructive rollback, approval transfer, automatic reapproval or scheduled recovery.
