# ATTHA’S Deterministic Layout System V1

ATTHA’S Creative OS does not allow the model to invent arbitrary poster CSS. Gemini generates strategy, concept, copy and visual direction; the application selects one approved deterministic layout family and renders verified overlays itself.

## Design principles

- Food remains the appetite hero.
- Headline, supporting copy, verified price and CTA remain deterministic overlays.
- Burger and Restaurant use the shared ATTHA’S palette while retaining distinct visual personalities.
- Layout selection is deterministic and auditable.
- A manual layout override is allowed only when the layout belongs to the same operating brand and supports the campaign aspect ratio.
- 9:16 campaigns always use a protected Story/Reel-cover layout.
- Logo placement remains excluded until final approved wordmark/sub-brand vector lockups exist.

## Burger families

1. `ATTHAS_BURGER_HERO_PRODUCT_V1` — crave-led product hero without a dominant price treatment.
2. `ATTHAS_BURGER_PROMOTIONAL_PRICE_V1` — verified price becomes a major conversion element.
3. `ATTHAS_BURGER_OFFER_DEAL_V1` — verified offer/deal copy receives a higher-energy treatment.
4. `ATTHAS_BURGER_MINIMAL_PREMIUM_V1` — lower-copy brand-building treatment.
5. `ATTHAS_BURGER_STORY_VERTICAL_V1` — 9:16 Story/Reel-cover composition.

## Restaurant families

1. `ATTHAS_RESTAURANT_FOOD_HERO_V1` — warm, spacious product-led campaign.
2. `ATTHAS_RESTAURANT_EDITORIAL_V1` — considered brand-building/editorial campaign.
3. `ATTHAS_RESTAURANT_MULTI_DISH_V1` — shared-table, variety or multi-dish direction.
4. `ATTHAS_RESTAURANT_HOSPITALITY_V1` — invitation/service/occasion-led campaign.
5. `ATTHAS_RESTAURANT_STORY_VERTICAL_V1` — 9:16 warm editorial Story/Reel-cover composition.

## Selection order

### Shared

- If aspect ratio is `9:16`, select the operating brand Story Vertical family.
- If a valid manual override is supplied, use it.

### Burger

1. verified offer/deal language → Offer / Deal
2. deterministic verified price overlay → Promotional Price
3. recommended concept is brand-building → Minimal Premium
4. otherwise → Hero Product

### Restaurant

1. shared-table / spread / variety direction → Multi Dish
2. recommended concept is brand-building → Editorial
3. deterministic verified price overlay → Food Hero
4. otherwise → Hospitality

## Safety

The layout system does not make a deferred fact safe. Pricing, offers, product availability, ingredients, allergens and product photography continue to pass through the existing truth and visual-safety gates. Layout selection only changes composition; it never upgrades verification status.

## Next refinements

- Add final approved logo lockup placement once vector masters are supplied.
- Add final-art legibility/crop QA against each layout zone.
- Add safe-regeneration feedback that tells image generation where negative space is required for the chosen layout.
- Validate all ten families across real ATTHA’S campaigns before freezing V1.
