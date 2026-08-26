# M2 Physical Food Composer Prototype Decision

**Decision date:** 2026-08-26  
**Model tested:** `gemini-3.5-flash-lite`  
**Run:** GitHub Actions `M2 Food Composer Prototype` run `33001575809`  
**Scope:** Prototype only. Synthetic inputs are not ATTHA'S product truth.

## Roadmap gate

The M2 plan requires 10 manual/live prototypes before an automated Physical Food Composer is allowed into production. The composer may creatively describe arrangement, layering, compression/contact, cut angle, visible surface texture, relative scale/proportion and lighting response. It must not invent ingredients, cooking methods, quality claims, portion/size claims or packaging/branding claims.

If the prototype drifts, the roadmap requires deterministic slot templates rather than an open-ended AI composer.

## Result

- Total cases: **10**
- Automated validator pass: **8**
- Automated validator fail: **2**
- Decision: **USE_DETERMINISTIC_SLOT_TEMPLATES**

The two automated failures were:

1. `P01` — the model returned `"NONE"` inside `cookingMethodsReferenced` instead of the required empty array. This is schema non-compliance rather than a factual cooking-method invention.
2. `P05` — the prototype validator raised a portion/size rule. The generated prose did not contain an obvious commercial portion claim, so this is treated as a validator-sensitivity issue rather than the primary reason for rejecting open-ended production use.

## Manual qualitative review

Manual review found more important drift inside outputs that the first-pass automated validator had marked as PASS. Examples include:

- `P02` described **"melted cheese"** although the input only confirmed `cheese` and did not confirm its physical state.
- `P04` described **"crisp lettuce"**, introducing an ingredient-quality attribute that was not confirmed.
- Several outputs selected very specific physical states and relative geometry that may be useful as art direction but become risky when ingredient/product truth is incomplete.

This demonstrates the core governance problem anticipated by the roadmap: even with a narrow prompt and explicit forbidden zones, an open-ended model can quietly convert plausible visual assumptions into factual-looking product description.

## Repository truth constraint

`clients/T001-atthas/truth/deferred-data.md` explicitly states that ingredients/descriptions are deferred and are not assumed complete or verified. Campaigns requiring those facts must use an admissible verified record or block rather than infer missing truth.

Therefore an AI composer must not be used as a substitute for missing ingredient truth.

## Decision

Do **not** ship the open-ended Gemini Physical Food Composer.

Implement a deterministic composer with governed slots:

- confirmed product identity
- confirmed ingredient list
- confirmed cooking methods, if any
- deterministic arrangement template selected from product form
- deterministic contact/layering language
- neutral visible-texture language that does not add qualities
- neutral relative-scale language

The composer must return a governed block when required ingredient truth is absent for product-specific composition.

The production implementation remains behind `useFoodComposer`, which defaults OFF. No existing production path changes until the deterministic composer is integrated and tested.
