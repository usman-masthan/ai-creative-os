# AI Creative Studio — Stage 1 Component Impact Acceptance Addendum

This addendum extends `CREATIVE_STUDIO_STAGE1_ACCEPTANCE.md` for the governed reusable-component dependency/impact phase on `layered-architecture`. It does not change the draft-PR branch policy: PR #51 remains a CI surface only and must not be merged into `main` without explicit approval.

## Acceptance matrix addendum

| Capability | Status | Acceptance evidence |
| --- | --- | --- |
| Component dependency impact analysis | PASS | `/api/studio/components/impact` scans every current same-client+brand DesignProject containing an attached root instance from the selected family and reports exact design/component versions, instance ids, upgrade readiness, blockers and approval/freeze state. |
| Exact-version approved freeze detection | PASS | Impact analysis queries version-bound Studio approval for each affected current DesignDocument. An approved current version is classified `FROZEN_APPROVED`; technical upgradeability never authorizes automatic mutation. |
| Destination truth + role impact simulation | PASS | Target-version analysis checks required confirmed destination truth, unique native destination text roles, then runs the same governed component replacement path in memory. Results distinguish `CURRENT_TARGET`, `UPGRADEABLE`, `BLOCKED_TRUTH`, `BLOCKED_TEXT_ROLE`, `BLOCKED_VERSION` and `BLOCKED_STRUCTURE`. |
| Stale impact detection | PASS | SHA-256 `impactToken` binds family/target structure to current dependent design versions, instance versions, approval state and diagnostics. Editing a dependent design changes the recomputed token. |
| Lifecycle impact guard | PASS | Deprecate/Archive are intercepted in Studio and server-side guarded. The server recomputes latest-family impact and requires the supplied token to match before lifecycle metadata changes. Reactivate remains explicit but does not require impact evidence. |
| Semantic authoring impact guard | PASS | `REVIEW_REQUIRED` authoring previews analyze the sanitized not-yet-persisted candidate against all current family instances. Publish requires both the authoring preview token and candidate impact token plus existing explicit compatibility acknowledgement/version notes. |
| Impact analysis is read-only | PASS | Analysis and token generation create no DesignDocument revision, component version, approval change or campaign lifecycle change. Only the later explicitly requested lifecycle/publish operation may mutate its own governed metadata/library surface. |
| Impact analysis cost discipline | PASS | Dependency discovery, approval checks, truth/role diagnostics, in-memory upgrade simulation and hashing are deterministic and add zero AI/model calls. |

## Required safety invariants

Stage 1 component impact is not accepted if any of the following regress:

1. Impact analysis must remain client+brand scoped and may not treat another brand's components or designs as dependencies.
2. Only root `componentInstance` groups count as attached instances; child provenance must not inflate dependency counts.
3. Approval/freeze state must be checked against the exact current DesignDocument version.
4. `FROZEN_APPROVED` designs must never be automatically upgraded, detached, re-saved or have approval state changed by impact analysis.
5. Target compatibility must use destination immutable task truth and native destination text-role bindings.
6. Missing task truth, missing required truth keys or missing/ambiguous native text roles must fail closed in the impact result.
7. Upgrade simulation must be in memory only and must reuse the governed component replacement path rather than a weaker approximation.
8. A changed dependent design version, approval state, attached component version, family state or target component contract must invalidate prior impact evidence.
9. Deprecate and Archive must require a freshly recomputed matching impact token server-side even if browser controls are bypassed.
10. Semantic (`REVIEW_REQUIRED`) component authoring must require candidate impact evidence in addition to the authoring preview token.
11. Publishing a new component version must still leave every existing instance bound to its previous immutable component id until an explicit upgrade/detach.
12. Impact analysis must add zero AI/model calls.

## Impact preflight state machine

```text
Selected component family + target version
→ scan current DesignProjects within exact client+brand
→ find attached root instances from family versions
→ read exact current DesignDocument version
→ read exact-version approval state
→ read destination immutable task truth
→ validate target required truth keys
→ validate target native text-role bindings
→ simulate governed upgrade in memory
→ classify each instance
→ aggregate designs / instances / blockers / approved frozen
→ hash current dependency state into impactToken
→ render read-only impact browser
```

## Lifecycle mutation state machine

```text
User chooses Deprecate or Archive
→ analyze latest family version impact
→ display affected designs / blockers / approved frozen instances
→ explicit user confirmation
→ send lifecycle request + impactToken
→ server recomputes impact from current state
→ token mismatch: reject as stale
→ token match: update family lifecycle metadata only
→ existing DesignDocuments and component instances unchanged
```

## Semantic authoring state machine

```text
Edited selected group
→ existing authoring structural/truth preview
→ compatibility = REVIEW_REQUIRED
→ analyze sanitized candidate as proposed vN+1
→ inspect every current family instance against candidate
→ return authoring preview token + candidate impact token
→ mandatory version notes + explicit review acknowledgement
→ publish request carries both tokens
→ server recomputes authoring candidate and dependency impact
→ either token stale: reject
→ both current: persist immutable component vN+1 + authoring audit only
→ existing instances unchanged
```

## Regression evidence

- `tests/creativeStudioComponentImpact.test.ts`
- `tests/creativeStudioComponentImpactLifecycle.test.ts`
- `tests/creativeStudioComponentImpactUi.test.ts`
- existing component authoring/lifecycle/component tests remain part of the repository-wide `npm run check` gate.

## Deferred behavior

This phase intentionally does not implement mass upgrade, auto-fix, scheduled migration or automatic approval invalidation. Those would be separate explicit workflows and must not be inferred from an impact result.
