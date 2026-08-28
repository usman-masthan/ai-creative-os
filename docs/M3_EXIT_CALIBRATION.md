# M3 Exit — Full Calibration Round 2

This harness implements the refined M3 exit gate before the 20–30 real ATTHA’S production-validation campaigns.

## Required calibration cases

1. **Burger brand awareness** — exact historical Calibration A request: `Create an emotional ATTHA'S Burger brand awareness post for Instagram. No offer and no price.`
2. **Visit tonight — Wellampitiya** — exact historical intent request: `Get more customers to Wellampitiya tonight with a strong Instagram post.`
3. **Family dining — Wellawatte** — exact historical family-dining request: `Create a premium family-dining campaign for ATTHA'S Restaurant Wellawatte.`
4. **Chicken Tikka Wrap** — the governed M2 synthetic product fixture, still tagged `M2_EXIT_SYNTHETIC_DO_NOT_PUBLISH` and still non-publishable.

The Wellampitiya and Wellawatte cases use only the owner-confirmed `branch-master.json` address and physical-opening-hours records. The brand-awareness case requires no customer-facing operational facts. The Chicken Tikka Wrap case uses only the in-memory synthetic calibration records from `src/m2ExitCalibration.ts`; no synthetic fact is written into client truth.

## Pipeline under test

Every case exercises the governed FINAL path:

`truth/fact gate → strategist → Creative Director → M3.2 copy policy → structured image brief → food composer where applicable → tiered Gemini image generation → composition-aware Visual QA → M3_V2 renderer → M3.3 nine-dimension Final Art QA`

M3 feature flags are forced on for calibration:

- `useStructuredBrief=true`
- `useFoodComposer=true`
- `useNewRenderer=true`

The image ladder remains finite: `FLASH_LITE → FLASH → PRO`. There is no fourth automatic image generation.

## Numeric exit score

The refined roadmap specifies a target score of **0–1** for all four cases and requires diagnosis for **2+**, but it does not define the numeric scale. The harness therefore makes the operational interpretation explicit:

- **0** — `FINAL_RENDERED`, M3.3 Final Art QA `PASS`, zero material automated QA or deterministic brief-invariant issues.
- **1** — `FINAL_RENDERED`, M3.3 Final Art QA `PASS`, exactly one residual material issue. Manual visual review decides whether it is acceptable.
- **2** — human-review/non-passing final outcome, or two or more material issues. Diagnose through `ai-trace.json` before moving forward.
- **3** — truth/governance/infrastructure block or unexpected pipeline error. Fix the blocking condition before rerunning.

This score is a calibration-control metric, not a Gemini quality score.

## Hard calibration invariants

- Brand-awareness output must not contain an offer/deal or a price.
- All FINAL cases must contain an M3 renderer plan and M3.3 Final Art QA PASS.
- No campaign without verified price truth may acquire a price overlay.
- The Wellampitiya case may use time-sensitive language only because owner-confirmed physical opening hours are present.
- Restaurant family dining must not invent reservation capability.
- Chicken Tikka Wrap remains synthetic, non-publishable, and must not gain unverified price, packaging, preparation method, side serving, or extra ingredients.

## Running live

The live round makes paid Gemini calls and requires explicit opt-in:

```bash
export M3_CALIBRATION_ALLOW_SYNTHETIC=true
export ALLOW_PAID_MEDIA=true
export GEMINI_API_KEY=... # use the configured local/CI secret; never commit it
npm run calibration:m3-exit
```

`CHROME_PATH` may be supplied when Chrome/Chromium cannot be auto-discovered by the execution environment.

Outputs are written under:

`output/m3-exit-calibration/<run-id>/`

The root contains `m3-exit-calibration-report.json`. Each case has its own directory with generated image attempts, `poster.png` when rendering is reached, Final Art QA output, poster manifest and `ai-trace.json`.

## Exit decision

Automated M3 exit requires all four cases to score 0 or 1. Manual visual review of the four finished posters is still mandatory before M3 is formally closed. Any score of 2 or 3 must be diagnosed from that case’s AI Trace; do not lower thresholds or bypass truth/final-art gates simply to make the calibration green.

## Successful exit evidence — 2026-08-28

The final bounded live run was GitHub Actions run `33154519467`, campaign run `M3-EXIT-2026-08-28T08-14-03-290Z`, on branch revision `ce2618f630a30209a11c128b6a8c4669b4de7dad` (production fixes validated immediately before the workflow-trigger-only revision).

Automated result: **PASS — 4/4 target cases scored 0**.

| Case | Status | Score | Image tier used |
| --- | --- | ---: | --- |
| Burger brand awareness | `FINAL_RENDERED` | 0 | Flash Lite |
| Visit tonight — Wellampitiya | `FINAL_RENDERED` | 0 | Flash Lite |
| Family dining — Wellawatte | `FINAL_RENDERED` | 0 | Flash Lite |
| Chicken Tikka Wrap | `FINAL_RENDERED` | 0 | Flash Lite |

Total image-generation estimate for the successful run: **USD 0.1344**. All four Final Art QA results were `PASS`; all applicable nine-dimension checks and evidence states were `PASS`, with non-applicable price/product/platform dimensions explicitly marked `NOT_APPLICABLE`.

Manual visual review also met the roadmap’s 0–1 tolerance:

- **Burger brand awareness:** clear hierarchy, brand identifier and CTA; no offer or price. Generic burger imagery remains calibration-only concept imagery and must not be represented as verified menu truth.
- **Visit tonight — Wellampitiya:** verified location/hours are readable and the invitation hierarchy is strong. Generic burger imagery remains concept-only rather than verified product representation.
- **Family dining — Wellawatte:** Restaurant supporting-copy contrast is materially improved and branch details are readable. Minor residual concern: the scene communicates hospitality/table setting more strongly than an explicit family/group moment.
- **Chicken Tikka Wrap:** strong product dominance, coherent synthetic verified ingredient set, no extra side-service configuration and no obvious unverified grill-line preparation cue.

The M3 exit calibration is therefore **PASS**. This does not make calibration imagery publishable and does not write synthetic facts into client truth. The next roadmap gate is the 20–30 real-campaign production validation before M4.