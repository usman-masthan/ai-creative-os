# AI Visual Consistency System

## Purpose

Use generative models for concept development and approved supporting imagery while maintaining a recognisable ATTHA’S visual language. Credentials must remain in local environment variables or secret storage and must never be committed.

## Consistency profile

```yaml
brand: "ATTHA’S"
sub_brand: "burger | restaurant | master"
palette:
  deep_red: "#B50008"
  appetite_red: "#D01920"
  flame_gold: "#FFD21A"
  warm_cream: "#FFF8E8"
  charcoal: "#171717"
lighting: "warm directional commercial food lighting"
food_rendering: "photoreal, fresh texture, believable portions"
logo_policy: "add approved logo in layout software; never ask image model to render it"
text_policy: "add all copy in layout software; no generated text"
```

## Burger image prompt template

```text
Use case: ads-marketing
Asset: ATTHA’S Burger campaign food hero
Subject: [verified product and exact visible ingredients]
Composition: eye-level three-quarter hero, strong stack silhouette, clean negative space on [left/right]
Lighting: warm directional commercial food light, crisp texture, natural shadow
Palette/environment: deep appetite red with restrained flame-gold accent and clean white support
Mood: bold, energetic, indulgent, premium but accessible
Accuracy: realistic portion, ingredients match the approved product record
Constraints: no text, no logo, no watermark, no competing packaging, no impossible ingredients, no hands unless requested
```

## Restaurant image prompt template

```text
Use case: ads-marketing
Asset: ATTHA’S Restaurant campaign image
Subject: [verified dish or dining occasion]
Composition: warm table-level or overhead editorial composition with generous negative space
Lighting: soft warm directional light, natural shadows, true-to-food colour
Palette/environment: warm cream, deep red, timber and restrained toasted-gold details
Mood: welcoming, authentic, generous and considered
Accuracy: culturally appropriate serving context; dish and portion match the approved product record
Constraints: no text, no logo, no watermark, no unrelated cuisine props, no competing packaging
```

## Required inputs per generation

- Sub-brand and branch.
- Exact product record and reference photographs.
- Intended channel and aspect ratio.
- Campaign objective and approved copy.
- Background/negative-space requirement.
- Real-photo, enhanced-photo or concept-image classification.

## QA scorecard

Reject an output if any mandatory category fails.

| Category | Mandatory check |
|---|---|
| Product truth | Visible ingredients, portion and product form are accurate |
| Brand fit | Correct sub-brand mood and palette |
| Realism | No malformed food, utensils, hands, shadows or packaging |
| Composition | Copy-safe area and crop resilience are present |
| Governance | Image classification and generation record are stored |
| Rights | Inputs and output are cleared for intended commercial use |

## Generation record

Store: asset ID, date, model/version, prompt version, seed/reference IDs where supported, source images, editor, branch/product scope, approval status and final-use locations. Never store the API key in the record.
