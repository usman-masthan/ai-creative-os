import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCampaignTypeCopyRules,
  campaignCopyPolicyPrompt,
  resolveCampaignCopyPolicy,
} from "../src/campaignCopyRules.js";
import type { CampaignCreativeOutput } from "../src/creativeTypes.js";
import type { VerifiedFact } from "../src/types.js";

function creative(input: {
  headline: string;
  supportingCopy?: string;
  cta: string;
}): CampaignCreativeOutput {
  return {
    concepts: [],
    recommendedConceptId: "C1",
    recommendationReason: "test",
    creativeBrief: {
      headline: input.headline,
      supportingCopy: input.supportingCopy ?? "Supporting copy",
      cta: input.cta,
      visualDirection: "test",
      composition: "test",
      lighting: "test",
      photographyStyle: "test",
      aspectRatio: "4:5",
    },
    caption: `${input.headline}. ${input.supportingCopy ?? "Supporting copy"}`,
    imageGeneration: {
      basePrompt: "test image",
      negativePrompt: "no text",
      visualConstraints: [],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: input.headline,
      supportingCopy: input.supportingCopy ?? "Supporting copy",
      cta: input.cta,
      logoUsage: "OMIT",
      placementHints: {
        headline: "copy zone",
        supportingCopy: "below headline",
        cta: "with copy",
        logo: "omit",
      },
    },
    factualQaNotes: [],
  };
}

function fact(key: string, value: unknown): VerifiedFact {
  return { key, value, verified: true, status: "VERIFIED" };
}

test("Restaurant DINE_IN resolves to the dedicated hospitality copy policy", () => {
  assert.equal(
    resolveCampaignCopyPolicy("DINE_IN", "ATTHAS_RESTAURANT"),
    "RESTAURANT_HOSPITALITY",
  );
  assert.equal(resolveCampaignCopyPolicy("DINE_IN", "ATTHAS_BURGER"), "DINE_IN");
});

test("PRODUCT_PUSH requires the verified product name and a Try/Order CTA", () => {
  const facts = [fact("productName", "Chicken Tikka Wrap")];
  assert.equal(
    assertCampaignTypeCopyRules(
      creative({ headline: "Chicken Tikka Wrap", cta: "Try It Today" }),
      { campaignType: "PRODUCT_PUSH", brandId: "ATTHAS_BURGER", facts },
    ),
    "PRODUCT_PUSH",
  );

  assert.throws(
    () =>
      assertCampaignTypeCopyRules(
        creative({ headline: "Unwrap the flavour", cta: "Try It Today" }),
        { campaignType: "PRODUCT_PUSH", brandId: "ATTHAS_BURGER", facts },
      ),
    /headline must name the verified product/,
  );
});

test("DINE_IN requires visit/occasion language and visit-style CTA", () => {
  const facts = [fact("physicalOpeningHours", "17:00-00:00")];
  assert.doesNotThrow(() =>
    assertCampaignTypeCopyRules(
      creative({ headline: "Your Evening Stop", cta: "Visit Us" }),
      { campaignType: "DINE_IN", brandId: "ATTHAS_BURGER", facts },
    ),
  );
  assert.throws(
    () =>
      assertCampaignTypeCopyRules(
        creative({ headline: "Your Evening Stop", cta: "Discover More" }),
        { campaignType: "DINE_IN", brandId: "ATTHAS_BURGER", facts },
      ),
    /CTA must use a visit action/,
  );
});

test("DINE_IN time-sensitive wording requires verified opening hours", () => {
  assert.throws(
    () =>
      assertCampaignTypeCopyRules(
        creative({ headline: "Visit Tonight", cta: "Visit Us" }),
        { campaignType: "DINE_IN", brandId: "ATTHAS_BURGER", facts: [] },
      ),
    /physicalOpeningHours is verified/,
  );
});

test("DELIVERY requires order intent and a verified delivery platform in CTA", () => {
  const facts = [fact("deliveryChannel", "Uber Eats")];
  assert.doesNotThrow(() =>
    assertCampaignTypeCopyRules(
      creative({ headline: "Order your favourite", cta: "Order on Uber Eats" }),
      { campaignType: "DELIVERY", brandId: "ATTHAS_BURGER", facts },
    ),
  );
  assert.throws(
    () =>
      assertCampaignTypeCopyRules(
        creative({ headline: "Order your favourite", cta: "Order Now" }),
        { campaignType: "DELIVERY", brandId: "ATTHAS_BURGER", facts },
      ),
    /verified platform/,
  );
});

test("OFFER requires unmistakable offer mechanics and Claim/Order/Visit CTA", () => {
  const facts = [fact("offerTerms", "Buy 1 Get 1")];
  assert.doesNotThrow(() =>
    assertCampaignTypeCopyRules(
      creative({ headline: "Buy 1 Get 1", supportingCopy: "This weekend", cta: "Claim It" }),
      { campaignType: "OFFER", brandId: "ATTHAS_BURGER", facts },
    ),
  );
  assert.throws(
    () =>
      assertCampaignTypeCopyRules(
        creative({ headline: "Something special", supportingCopy: "This weekend", cta: "Claim It" }),
        { campaignType: "OFFER", brandId: "ATTHAS_BURGER", facts },
      ),
    /offer mechanics unmistakably clear/,
  );
});

test("BRAND_BUILDING rejects generic defaults and requires an ATTHA'S exploratory CTA", () => {
  assert.doesNotThrow(() =>
    assertCampaignTypeCopyRules(
      creative({ headline: "Where flavour finds its crowd", cta: "Discover ATTHA'S" }),
      { campaignType: "BRAND_BUILDING", brandId: "ATTHAS_BURGER", facts: [] },
    ),
  );
  assert.throws(
    () =>
      assertCampaignTypeCopyRules(
        creative({ headline: "Passion for flavour", cta: "Discover ATTHA'S" }),
        { campaignType: "BRAND_BUILDING", brandId: "ATTHAS_BURGER", facts: [] },
      ),
    /generic default.*Passion for flavour/,
  );
  assert.throws(
    () =>
      assertCampaignTypeCopyRules(
        creative({ headline: "Where flavour finds its crowd", cta: "Discover More" }),
        { campaignType: "BRAND_BUILDING", brandId: "ATTHAS_BURGER", facts: [] },
      ),
    /must identify ATTHA'S/,
  );
});

test("Restaurant hospitality requires warm occasion language and truth-safe reservation CTA", () => {
  const base = creative({ headline: "A Table for Shared Moments", cta: "Join Us" });
  assert.equal(
    assertCampaignTypeCopyRules(base, {
      campaignType: "DINE_IN",
      brandId: "ATTHAS_RESTAURANT",
      facts: [],
    }),
    "RESTAURANT_HOSPITALITY",
  );

  assert.throws(
    () =>
      assertCampaignTypeCopyRules(
        creative({ headline: "A Table for Shared Moments", cta: "Reserve Now" }),
        { campaignType: "DINE_IN", brandId: "ATTHAS_RESTAURANT", facts: [] },
      ),
    /Reserve CTA requires verified reservation\/booking capability/,
  );

  assert.doesNotThrow(() =>
    assertCampaignTypeCopyRules(
      creative({ headline: "A Table for Shared Moments", cta: "Reserve Now" }),
      {
        campaignType: "DINE_IN",
        brandId: "ATTHAS_RESTAURANT",
        facts: [fact("reservationAvailability", true)],
      },
    ),
  );
});

test("policy prompt includes the roadmap policy and forbidden defaults", () => {
  const prompt = campaignCopyPolicyPrompt({
    campaignType: "DELIVERY",
    brandId: "ATTHAS_BURGER",
  });
  assert.match(prompt, /M3\.2 COPY POLICY: DELIVERY/);
  assert.match(prompt, /Order.*verified delivery platform/);
  assert.match(prompt, /Passion for flavour/);
  assert.match(prompt, /Made with love/);
});
