# ATTHA'S Production Integration Hardening

This hardening closes the gap between the calibrated M2/M3 engine and the Marketing Manager workspace before the 20–30 real-campaign validation.

## Production profile

The workspace now invokes the calibrated production path directly:

- structured image brief: enabled
- deterministic Food Composer: enabled
- M3 renderer: enabled
- FINAL mode: Visual QA + Final Art QA remain mandatory

The operator no longer has to remember rollout environment flags for the workspace.

## Product visual paths

A PRODUCT_PUSH task must explicitly choose one governed source:

1. `APPROVED_REAL_PRODUCT_PHOTO`
   - the actual image must be uploaded and bound to the same campaign/session/brand/branch/product
   - advertising approval, appearance accuracy and ingredient-match confirmation are recorded on the upload asset
   - Visual QA receives `VERIFIED_PRODUCT_VISUAL` and deterministic rights status

2. `AI_GENERATION_ALLOWED`
   - no real base image is bound
   - verified visible ingredients are mandatory
   - must-include / must-not-include arrays are confirmed for the task
   - the calibrated structured-brief/Food-Composer/image-tier path is used

## UI safety

- branch availability is a typed Yes/No value
- price is numeric
- ingredient and include/exclude facts are arrays
- selecting a new file invalidates an older upload binding
- Produce refuses to silently fall back to AI when a file is selected but not uploaded
- the result view displays the inner production status and QA reason when no poster is rendered

## Operations

A successful FINAL render moves the persisted campaign from `DRAFT` to `INTERNAL_REVIEW`; human/client approval is still required before later lifecycle states.

## Validation rule

The 20–30 real ATTHA'S campaign validation should restart from Campaign 01 only after this branch passes normal PR CI and is merged to `main`.
