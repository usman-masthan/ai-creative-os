import type { AtthasLayoutDefinition } from "./layouts/atthas.js";

export type PhotographyPresetId =
  | "QSR_MACRO_HERO"
  | "QSR_LIFESTYLE"
  | "RESTAURANT_PLATED"
  | "RESTAURANT_AMBIENCE"
  | "BRAND_ATMOSPHERE"
  | "DELIVERY_CONTEXT";

export interface PhotographyPreset {
  id: PhotographyPresetId;
  useCase: string;
  perspective: string;
  lensFeel: string;
  lighting: string;
  depthOfField: string;
  realism: string;
  background: string;
  atmosphere?: string;
}

export const PHOTOGRAPHY_PRESETS: Readonly<Record<PhotographyPresetId, PhotographyPreset>> = {
  QSR_MACRO_HERO: {
    id: "QSR_MACRO_HERO",
    useCase: "Single burger, wrap or chicken close-up.",
    perspective: "close three-quarter food-level perspective",
    lensFeel: "natural commercial-food compression with no wide-angle distortion",
    lighting: "controlled directional key light with soft fill to reveal real surface texture",
    depthOfField: "shallow-to-moderate depth of field with the complete hero food readable",
    realism: "photoreal commercial food photography; believable scale, gravity and ingredient contact",
    background: "restrained dark neutral food-studio surface",
  },
  QSR_LIFESTYLE: {
    id: "QSR_LIFESTYLE",
    useCase: "Food with approved human or environmental context.",
    perspective: "natural diner-eye perspective with food remaining the primary subject",
    lensFeel: "documentary-commercial lens feel without exaggerated perspective",
    lighting: "warm practical-style light supported by soft controlled fill",
    depthOfField: "moderate depth of field preserving food and approved contextual action",
    realism: "photoreal lifestyle food photography with physically credible hands, table scale and contact",
    background: "restrained real-world dining context with no readable signage or branding",
    atmosphere: "social, energetic and believable without implying unverified service claims",
  },
  RESTAURANT_PLATED: {
    id: "RESTAURANT_PLATED",
    useCase: "Individual restaurant dish or considered plated-food hero.",
    perspective: "slightly elevated three-quarter plated-food perspective",
    lensFeel: "editorial food lens with natural proportions",
    lighting: "soft directional restaurant-editorial light with controlled highlights",
    depthOfField: "moderate depth of field keeping the complete plate construction understandable",
    realism: "photoreal plated-food photography with believable plate scale and ingredient placement",
    background: "warm restrained tabletop or neutral restaurant surface",
  },
  RESTAURANT_AMBIENCE: {
    id: "RESTAURANT_AMBIENCE",
    useCase: "Interior, table or hospitality experience.",
    perspective: "natural seated or standing hospitality perspective",
    lensFeel: "moderately wide environmental lens without architectural distortion",
    lighting: "warm ambient hospitality light with realistic practical sources",
    depthOfField: "moderate-to-deep depth of field so the environment remains coherent",
    realism: "photoreal hospitality photography with credible furniture, table spacing and human scale",
    background: "believable restaurant environment without fabricated signage, menu text or awards",
    atmosphere: "warm and welcoming without making service-quality claims",
  },
  BRAND_ATMOSPHERE: {
    id: "BRAND_ATMOSPHERE",
    useCase: "Brand mood without dependence on a specific SKU.",
    perspective: "simple editorial perspective driven by one clear focal subject or material cue",
    lensFeel: "premium restrained editorial lens feel",
    lighting: "controlled sculptural light with deliberate negative space",
    depthOfField: "selective focus appropriate to a minimal brand image",
    realism: "photoreal brand-world photography; no surreal product mutation or fabricated brand assets",
    background: "minimal neutral or brand-compatible atmosphere with generous quiet space",
  },
  DELIVERY_CONTEXT: {
    id: "DELIVERY_CONTEXT",
    useCase: "Food with explicitly approved delivery or packaging context.",
    perspective: "natural tabletop or handoff perspective with food remaining visually primary",
    lensFeel: "clean commercial lens with believable scale",
    lighting: "clear neutral-to-warm commercial light that preserves food and packaging form",
    depthOfField: "moderate depth of field preserving food and approved packaging context",
    realism: "photoreal delivery-context photography with physically credible packaging and food placement",
    background: "clean delivery or takeaway context without invented printed packaging, logos or app UI",
  },
};

export function getPhotographyPreset(id: PhotographyPresetId): PhotographyPreset {
  return PHOTOGRAPHY_PRESETS[id];
}

export function selectPhotographyPresetId(input: {
  brandId: string;
  layout: AtthasLayoutDefinition;
  explicitPreset?: PhotographyPresetId;
}): PhotographyPresetId {
  if (input.explicitPreset) return input.explicitPreset;

  if (input.brandId === "ATTHAS_RESTAURANT") {
    if (input.layout.id === "ATTHAS_RESTAURANT_HOSPITALITY_V1") {
      return "RESTAURANT_AMBIENCE";
    }
    if (input.layout.id === "ATTHAS_RESTAURANT_STORY_VERTICAL_V1") {
      return "BRAND_ATMOSPHERE";
    }
    return "RESTAURANT_PLATED";
  }

  if (input.layout.id === "ATTHAS_BURGER_MINIMAL_PREMIUM_V1") {
    return "BRAND_ATMOSPHERE";
  }
  return "QSR_MACRO_HERO";
}
