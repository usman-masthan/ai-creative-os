# Creative Studio — Creative Orchestrator

## Purpose

The Creative Orchestrator is the governed coordination layer between confirmed task truth and the existing campaign-production pipeline.

It is intentionally **not** a second AI generation system and it does not create fake multi-agent processes. It coordinates the responsibilities that already exist in AI Creative OS, records the approved execution contract before production, and extracts an auditable execution record afterward.

## Governed creation flow

```text
Structured CreativeBrief
→ registered client truth provider
→ explicit questionnaire confirmation
→ immutable TaskTruthSnapshot
→ CreativeOrchestrationPlan
→ existing governed campaign production
→ DesignDocument assembly
→ orchestration provenance link
→ CreativeOrchestrationExecution audit
→ editable Creative Studio
```

Production in the brief-driven Studio path must not begin before the orchestration plan reaches `READY_FOR_GOVERNED_PRODUCTION`.

## Plan contract

`src/creativeStudio/orchestrator.ts` defines `CreativeOrchestrationPlan`.

Every plan is bound to:

- campaign id
- CreativeBrief id
- client id
- brand id
- exact confirmed task-truth snapshot
- confirmer and confirmation timestamp
- registered brand kit
- registered layout provider

It coordinates three real responsibilities:

1. `COPY_CONTENT`
   - confirmed-truth-only customer-facing copy
   - native editable promotional typography
   - no invented price, offer, ingredient, branch, contact or date facts
2. `ASSET_DIRECTION`
   - image/asset direction and provenance
   - no promotional text, prices or logos inside generated imagery
   - generated media can never become `VERIFIED_PRODUCT_VISUAL`
3. `LAYOUT_ART_DIRECTION`
   - AI-guided visual/composition direction
   - exact geometry remains deterministic layout software
   - typography, logo, CTA and price remain structural layers

All three depend on confirmed truth, brand context and creative strategy. They may run concurrently only when the underlying governed production dependencies permit it.

## Production guards

A valid plan requires all of these invariants:

- `confirmedTruthOnly = true`
- `nativeTypographyRequired = true`
- `approvedLogoOnly = true`
- `deterministicLayoutRequired = true`
- `generatedMediaCannotBecomeVerifiedProductVisual = true`
- `creativeDirectorReviewRequired = true`

The validator rejects a plan that weakens any of them.

## Persistence

`FileCreativeOrchestrationStore` stores:

```text
.atthas-os/
└── orchestrations/
    ├── plans/<orchestration-id>.json
    ├── executions/<orchestration-id>.json
    └── campaigns/<campaign-id>.json
```

Plans and execution records are immutable. Re-saving byte-equivalent content is idempotent; attempting to overwrite the same identity with different content is a conflict.

The resulting DesignProject also receives `orchestration.json`. Linking fails if campaign, CreativeBrief, task truth, client or brand provenance differs from the DesignDocument.

## Execution audit

`src/creativeStudio/orchestrationExecution.ts` derives the execution audit from the **existing** AI trace and final DesignDocument. It does not invoke a model.

The audit records:

- copy specialist output and existing strategist/finalizer provider/model attribution
- asset direction, image provider/model attribution and final media provenance
- layout direction, selected governed layout and deterministic geometry profile
- Creative Director stage status/provider/model evidence
- deterministic Design QA state when available
- visual QA and final-art QA trace state
- deterministic renderer evidence
- final design id/version
- exact task-truth binding

`extraModelCallsAddedByOrchestrator` is permanently `0` in the v1 execution contract.

## API surface

```text
POST /api/studio/orchestrate
GET  /api/studio/orchestration?campaignId=...
POST /api/studio/orchestration/link
POST /api/studio/orchestration/complete
GET  /api/studio/orchestration/execution?orchestrationId=...
```

The active Studio path uses the endpoints in this order:

```text
truth confirm
→ orchestrate
→ existing production
→ open DesignDocument
→ link orchestration provenance
→ complete execution audit
→ load editable Studio project
```

## Cost discipline

The orchestrator is a coordination/governance layer, not another model tier.

- plan creation: 0 model calls
- provenance linking: 0 model calls
- execution audit extraction: 0 model calls
- existing campaign strategist/finalizer/image/Creative Director calls are attributed, not repeated

This preserves the current paid-media and provider-selection controls.

## Relationship to DesignDocument

The orchestration plan describes **why and under which governed constraints** a creative may be produced.

The DesignDocument remains the canonical editable representation of **what was produced**.

The execution audit describes **how the existing governed pipeline actually produced it**.

These are separate contracts on purpose:

```text
CreativeBrief + TaskTruthSnapshot
          ↓
CreativeOrchestrationPlan       ← intent + governance
          ↓
Existing governed production
          ↓
DesignDocument                  ← canonical editable design
          ↓
CreativeOrchestrationExecution  ← execution provenance/audit
```

## Backward compatibility

Existing rendered campaigns can still be opened in Studio without historical orchestration metadata. The orchestration requirement applies to new **brief-driven Studio production** and does not rewrite older campaign records or bypass the existing Marketing Manager workflow.
