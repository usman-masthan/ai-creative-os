import type { Tenant, TenantId } from "./types.js";

export const tenants: Record<TenantId, Tenant> = {
  T001: {
    id: "T001",
    slug: "atthas",
    name: "ATTHA'S",
    type: "commercial",
    riskProfile: "commercial",
    brands: [
      { id: "ATTHAS_RESTAURANT", name: "ATTHA'S Authentic Multi Cuisine" },
      { id: "ATTHAS_BURGER", name: "ATTHA'S Burger" },
    ],
  },
  T002: {
    id: "T002",
    slug: "skk",
    name: "SKK Meat Goodies",
    type: "commercial",
    riskProfile: "commercial",
    brands: [{ id: "SKK_MEAT_GOODIES", name: "SKK Meat Goodies" }],
  },
  T003: {
    id: "T003",
    slug: "lifeline",
    name: "Lifeline Association Sri Lanka",
    type: "ngo",
    riskProfile: "humanitarian-strict",
    brands: [{ id: "LIFELINE", name: "Lifeline Association Sri Lanka" }],
  },
};

export function getTenant(tenantId: TenantId): Tenant {
  return tenants[tenantId];
}

export function assertBrandBelongsToTenant(
  tenantId: TenantId,
  brandId: string,
): void {
  const tenant = getTenant(tenantId);
  const belongs = tenant.brands.some((brand) => brand.id === brandId);

  if (!belongs) {
    throw new Error(
      `TENANT_ISOLATION_VIOLATION: brand ${brandId} does not belong to ${tenantId}`,
    );
  }
}
