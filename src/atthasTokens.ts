export const ATTHAS_TOKENS = Object.freeze({
  colours: Object.freeze({
    primaryRed: "#B50008",
    secondaryRed: "#D01920",
    deepRed: "#820008",
    primaryYellow: "#FFD21A",
    secondaryYellow: "#F2B705",
    white: "#FFFFFF",
    cream: "#FFF8E8",
    ink: "#171717",
    grey: "#68635E",
  }),
  typography: Object.freeze({
    burgerDisplay: "Oswald",
    restaurantDisplay: "Libre Baskerville",
    body: "Inter",
    price: "Oswald",
  }),
  brandIdentifier: Object.freeze({
    burger: "ATTHA'S BURGER",
    restaurant: "ATTHA'S RESTAURANT",
  }),
});

export type AtthasColourToken = keyof typeof ATTHAS_TOKENS.colours;
export type AtthasOperatingBrand = "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";

export function atthasBrandIdentifier(brandId: AtthasOperatingBrand): string {
  return brandId === "ATTHAS_BURGER"
    ? ATTHAS_TOKENS.brandIdentifier.burger
    : ATTHAS_TOKENS.brandIdentifier.restaurant;
}

export function atthasDisplayFont(brandId: AtthasOperatingBrand): string {
  return brandId === "ATTHAS_BURGER"
    ? ATTHAS_TOKENS.typography.burgerDisplay
    : ATTHAS_TOKENS.typography.restaurantDisplay;
}

export function atthasCssVariables(): string {
  const colours = ATTHAS_TOKENS.colours;
  return [
    `--atthas-red-deep: ${colours.primaryRed};`,
    `--atthas-red-appetite: ${colours.secondaryRed};`,
    `--atthas-red-ember: ${colours.deepRed};`,
    `--atthas-gold-flame: ${colours.primaryYellow};`,
    `--atthas-gold-toasted: ${colours.secondaryYellow};`,
    `--atthas-white: ${colours.white};`,
    `--atthas-cream: ${colours.cream};`,
    `--atthas-ink: ${colours.ink};`,
    `--atthas-grey: ${colours.grey};`,
  ].join("\n");
}
