# ATTHA’S Product Visual Truth

This directory controls whether an image may be treated as evidence of an actual ATTHA’S product.

## Visual classes

- `VERIFIED_PRODUCT_VISUAL` — approved real product photography mapped to the correct product and permitted branch scope.
- `CONSTRAINED_PRODUCT_GENERATION` — AI-generated or enhanced imagery built from verified product facts/reference images and passed through visual QA; human approval is still required for final advertising use unless explicitly waived.
- `GENERIC_CONCEPT_VISUAL` — concept-only imagery. It may not be presented as the actual product and may not automatically enter final production.

## Hard rules

1. A public delivery-platform image does not automatically carry advertising reuse rights.
2. A product photo from one branch does not prove serving style or availability at another branch.
3. AI-generated food imagery is never evidence of actual ingredients, portion or appearance.
4. A generated final-production visual requires exact product scope, branch scope, verified visible ingredients/reference inputs, a generation record and visual QA.
5. If product appearance cannot be verified, Creative OS must use an approved real photo or stop at `GENERIC_CONCEPT_VISUAL`.

## Required asset fields

Every image record must track:

- `imageId`
- `imageType`
- `brandId`
- `branchScope`
- `productId`
- `sourceType`
- `sourceUrl` where relevant
- `observedAt`
- `ownershipStatus`
- `approvedForAds`
- `identityConfidence`
- `appearanceVerified`
- `ingredientMatchVerified`
- `approvalStatus`

See `schemas/atthas-product-visual.schema.json` for the machine-readable contract.
