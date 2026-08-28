# M2 Exit Calibration

This is the governed mini-calibration for the M2 structured image pipeline.

## Truth boundary

`Chicken Tikka Wrap` is **not current publishable ATTHA'S truth in this repository**. The public restaurant snapshot lists it only as a historical/recent-unconfirmed product and warns that such products must not be advertised without new verification.

For that reason, this calibration uses an in-memory synthetic record set tagged:

`M2_EXIT_SYNTHETIC_DO_NOT_PUBLISH`

The synthetic records are created only by `src/m2ExitCalibration.ts`. They are never written to `clients/T001-atthas/truth/` and must never be copied into business truth, campaign truth, menus, pricing, captions or published creative.

## What the calibration exercises

The runner uses the real M2 production path:

1. Strategist
2. Creative Director
3. Finalizer
4. structured image brief
5. deterministic food composer
6. structured brief governance/repair
7. Flash Lite image generation
8. composition-aware Visual QA
9. QA-driven escalation to Flash and Pro when required
10. deterministic poster rendering after the image passes

The runner keeps `useNewRenderer=false`; renderer overhaul remains M3 work.

## Required environment

The run is intentionally blocked unless both of these are set:

```bash
export M2_CALIBRATION_ALLOW_SYNTHETIC=true
export ALLOW_PAID_MEDIA=true
```

A valid `GEMINI_API_KEY` is also required by the Gemini providers.

If Chrome/Chromium is not in one of the standard locations, set:

```bash
export CHROME_PATH="/path/to/chrome"
```

Optional baseline for the roadmap old-vs-new comparison:

```bash
export M2_BASELINE_IMAGE_PATH="/path/to/old/draft-attempt-01.jpg"
```

## Run

```bash
npm run calibration:m2-exit
```

The output is written under:

`output/m2-exit-calibration/<campaign-id>/`

The key file is:

`m2-exit-calibration-report.json`

It includes every generated image attempt, model tier, provisional quality gate, structured brief, food composition, Visual QA result, final raw image path, rendered poster path, four copy-zone ratings and the manual review checklist.

## Exit review

M2 is not considered empirically calibrated merely because CI passes. Review the generated artifacts and confirm:

- no dark rectangles, accidental graphic panels, badges, labels or baked-in promotional design
- no ingredients outside the synthetic calibration list
- credible food texture and lighting
- good crop and hero placement
- copy-zone analysis corresponds to what is actually visible in the pixels
- rendered copy is placed only where the background is genuinely suitable
- old-vs-new raw image comparison is completed when a baseline is available

The report's automated pass is deliberately stricter than a raw Visual QA `PASS`: it also requires productTruth >= 90, realism >= 85, foodTexture >= 82, composition >= 83, governance >= 90, no detected graphic leakage, and copy-zone evidence.

## Important calibration distinction

The M2 exit run is a **mini-calibration** of the integrated pipeline. The M2.8 model-escalation thresholds remain provisional until a broader 20-image calibration set is reviewed. Do not treat the current thresholds as permanently tuned production values until that work is complete.


## 2026-08-28 exit result

The integrated M2 exit calibration is **closed as PASS for the selected candidate**. The run remained synthetic, non-publishable and performed no truth write-back.

- Selected reference: `draft-attempt-01.jpg` from `gemini-3.1-flash-lite-image`.
- Corrected evidence-aware Visual QA: PASS with productTruth 90, realism 85, foodTexture 82, composition 83, governance 90 and upper-left copy zone GOOD.
- Manual visual review: PASS. The selected image had no baked-in graphic elements, no obvious extra ingredient, credible food texture/lighting and the strongest upper-left copy-safe area of the three attempts.
- Attempt 2 exposed a QA false positive: grill marks plus a separate side salad / sauce ramekin implied unverified preparation and serving configuration. M2 was not closed until a deterministic serving/preparation truth guard and regression tests were added.
- Attempt 3 was visually strong but had a less reliable upper-left copy zone than attempt 1 in manual review.

This closes the M2 mini-calibration and authorizes moving to M3 renderer work. The M2.8 Flash Lite / Flash / Pro score thresholds are still explicitly provisional until the separate 20-image calibration set is completed.
