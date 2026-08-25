# Colour Palette

## Status

The palette below is derived from the client-approved visual reference. HEX values are production working values and should be checked against original vector artwork and a calibrated print proof before being marked final.

## Master palette

| Token | Name | HEX | RGB | CMYK approximation | Primary use |
|---|---|---:|---:|---:|---|
| `brand.red.700` | ATTHA’S Deep Red | `#B50008` | 181, 0, 8 | 0, 100, 96, 29 | Primary backgrounds, headers, brand fields |
| `brand.red.600` | Appetite Red | `#D01920` | 208, 25, 32 | 0, 88, 85, 18 | Prices, emphasis, active states |
| `brand.red.800` | Ember Red | `#820008` | 130, 0, 8 | 0, 100, 94, 49 | Gradient depth and premium Restaurant accents |
| `brand.yellow.500` | Flame Gold | `#FFD21A` | 255, 210, 26 | 0, 18, 90, 0 | Logo accent, highlights, CTA emphasis |
| `brand.yellow.600` | Toasted Gold | `#F2B705` | 242, 183, 5 | 0, 24, 98, 5 | Print accents and warm secondary fills |
| `neutral.white` | Clean White | `#FFFFFF` | 255, 255, 255 | 0, 0, 0, 0 | Copy on red, clean content fields |
| `neutral.cream` | Warm Cream | `#FFF8E8` | 255, 248, 232 | 0, 3, 9, 0 | Restaurant backgrounds, premium warmth |
| `neutral.ink` | Charcoal Ink | `#171717` | 23, 23, 23 | 0, 0, 0, 91 | Body copy and headings on light fields |
| `neutral.grey.600` | Service Grey | `#68635E` | 104, 99, 94 | 0, 5, 10, 59 | Secondary information only |

## Digital variables

```css
:root {
  --atthas-red-deep: #B50008;
  --atthas-red-appetite: #D01920;
  --atthas-red-ember: #820008;
  --atthas-gold-flame: #FFD21A;
  --atthas-gold-toasted: #F2B705;
  --atthas-white: #FFFFFF;
  --atthas-cream: #FFF8E8;
  --atthas-ink: #171717;
  --atthas-grey: #68635E;
}
```

## Recommended ratios

### ATTHA’S Burger

- 55% deep red
- 25% white
- 12% charcoal
- 8% flame gold

### ATTHA’S Restaurant

- 45% warm cream or white
- 25% deep/ember red
- 20% charcoal
- 10% toasted gold

## Approved combinations

| Background | Primary text | Accent | Use |
|---|---|---|---|
| Deep Red | White | Flame Gold | Hero areas, Burger campaigns |
| White | Charcoal Ink | Appetite Red | Menus and information-heavy layouts |
| Warm Cream | Charcoal Ink | Ember Red/Toasted Gold | Restaurant editorial layouts |
| Charcoal Ink | White | Flame Gold | Limited premium or late-night executions |

## Avoid

- Yellow body text on white or cream.
- Red body text on black for long passages.
- Large 50/50 red-and-yellow fields that compete for attention.
- Unapproved blues, purples or neon colours as core campaign colours.
- Changing the logo colours to match individual food photography.
- Gradients containing more than two brand reds; avoid rainbow gradients.

## Accessibility

- Use white or near-white text on deep red for large headings; verify smaller copy with a contrast checker.
- Use charcoal on white/cream for body copy.
- Treat yellow as a highlight colour. Do not rely on yellow alone to communicate status.
- Every digital execution must meet WCAG 2.2 AA for the actual type size and weight used.
