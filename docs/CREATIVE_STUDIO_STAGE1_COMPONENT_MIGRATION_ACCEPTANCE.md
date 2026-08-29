# AI Creative Studio — Stage 1 Component Migration Acceptance Addendum

This addendum extends `CREATIVE_STUDIO_STAGE1_ACCEPTANCE.md` and `CREATIVE_STUDIO_STAGE1_COMPONENT_IMPACT_ACCEPTANCE.md` for the impact-aware reusable-component migration phase on `layered-architecture`. PR #51 remains a draft CI surface only and must not be merged into `main` without explicit approval.

## Acceptance matrix addendum

| Capability | Status | Acceptance evidence |
| --- | --- | --- |
| Immutable dry-run migration plan | PASS | `FileCreativeComponentMigrationPlanner.createPlan` reruns current impact analysis, records the source impact token, groups eligible instances by DesignDocument and persists an immutable client+brand-scoped plan. |
| Eligible-only migration candidates | PASS | Only `EDITABLE + UPGRADEABLE` instances enter `eligibleDesigns`. Approved/frozen, current-target and blocked instances remain explicit exclusions with governance/readiness reason. |
| Per-design transition preview | PASS | Every eligible item records exact source DesignDocument version, proposed `source+1` version, planned instance ids/current component versions, target component/version and a deterministic design precondition token. |
| Design-level atomic revision | PASS | Multiple planned component instances in one design are upgraded in memory, then collapsed into one `vN → vN+1` migration history entry and one persisted QA result. |
| Selected-design execution | PASS | Studio checkboxes default to eligible designs only and allow deliberate per-design or selected-subset execution. Non-selected eligible designs remain unchanged. |
| Stored-plan execution guard | PASS | `/api/studio/components/migration-execute` accepts a stored `planId`, expected plan token and selected item ids. It never trusts a client-supplied plan object. |
| Stale design precondition guard | PASS | Execution requires the exact planned DesignDocument version, current unapproved state, root instance provenance and per-design precondition token. Edited/upgraded/detached/reapproved design state fails closed. |
| All-selected preflight before save | PASS | Every selected design is loaded, provenance-checked, truth-revalidated, migrated in memory and deterministic-QA checked before the persistence loop starts. A normal preflight failure prevents another selected design from being saved. |
| Deterministic QA migration gate | PASS | Each proposed migrated DesignDocument reruns `runDesignQa`; `BLOCK` rejects the selected execution before persistence. Successful design revisions persist their QA result. |
| Independent execution from one plan | PASS | Per-design preconditions allow Design A and Design B from one immutable plan to be executed separately; migrating A does not invalidate unchanged B. A changed B requires a fresh plan. |
| Immutable migration execution audit | PASS | Successful executions persist plan id, target component/version, selected item ids, per-design source/result versions, migrated instance ids, QA decision and timestamp under `_migrations/executions`. |
| Migration cost discipline | PASS | Impact scan, planning, hashing, governed replacement, deterministic QA and persistence add zero AI/model calls. |

## Required safety invariants

Stage 1 migration is not accepted if any of the following regress:

1. Migration planning must remain client+brand scoped.
2. A component family must be `ACTIVE` to create or execute a migration plan.
3. Only `EDITABLE + UPGRADEABLE` instances may enter the eligible migration set.
4. `FROZEN_APPROVED` exact current design versions must never enter the eligible set.
5. Blocked/current-target instances must be recorded as exclusions rather than silently dropped.
6. A migration plan must remain immutable after creation.
7. Execution must reload the stored plan server-side and verify its expected plan token.
8. The client must not be able to provide arbitrary migration document operations or a fabricated plan object.
9. Every selected DesignDocument must still equal its planned source version.
10. Any selected design that becomes approved after planning must fail execution.
11. Planned root instance/component provenance must still match at execution.
12. Destination immutable task truth must be reloaded at execution.
13. Migration must reuse governed `replaceReusableComponentInstance` semantics.
14. Every selected design must finish in-memory migration + deterministic QA preflight before the first selected design is saved.
15. QA `BLOCK` must prevent persistence.
16. One migrated design must create exactly one new DesignDocument revision regardless of how many planned instances it contains.
17. One migrated design must persist one deterministic QA result for the resulting revision.
18. Non-selected eligible designs must remain unchanged.
19. Frozen/blocked excluded designs must remain unchanged.
20. Existing component definitions and the immutable migration plan must not be rewritten by execution.
21. Execution audits must be immutable.
22. Planning/execution must add zero AI/model calls.
23. No migration flow may turn component instances into live-linked objects or auto-upgrade future designs.

## Dry-run planning state machine

```text
Selected family + target immutable version
→ family must be ACTIVE
→ rerun exact dependency impact analysis
→ EDITABLE + UPGRADEABLE instances
→ group by DesignDocument
→ record source vN → proposed vN+1
→ compute per-design precondition tokens
→ record all frozen/blocked/current-target exclusions
→ persist immutable migration plan + planToken
→ render read-only plan preview with eligible checkboxes
```

## Selected execution state machine

```text
User selects one or more eligible design items
→ explicit confirmation
→ send stored planId + expectedPlanToken + selected item ids
→ reload immutable plan
→ family/target still valid + ACTIVE
→ for every selected design:
   exact source version check
   exact current approval check
   root instance provenance check
   per-design precondition-token check
   reload immutable task truth
   governed replacement of planned instances in memory
   collapse intermediate instance upgrades to one design revision
   deterministic QA
→ any preflight/QA failure: reject before save loop
→ all prepared successfully:
   save each design once
   save each QA result once
→ persist immutable execution audit
→ require a fresh dry-run for further migration planning in the browser
```

## Regression evidence

- `tests/creativeStudioComponentMigration.test.ts`
- `tests/creativeStudioComponentMigrationUi.test.ts`
- existing dependency-impact, lifecycle and component authoring tests remain part of repository-wide `npm run check`.

## Persistence

```text
.atthas-os/components/<clientId>/<brandId>/_migrations/plans/<planId>.json
.atthas-os/components/<clientId>/<brandId>/_migrations/executions/<executionId>.json
```

## Deferred behavior

This phase intentionally does not implement cross-design database transactions, scheduled migrations, automatic remediation of blocked designs, approved-design revision workflows or automatic approval invalidation. Those require separate explicit governance/persistence decisions and must not be inferred from migration eligibility.
