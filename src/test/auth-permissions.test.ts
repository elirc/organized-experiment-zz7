/**
 * What this file does: Verifies the permission guard rejects a lower-privilege role and allows a valid one.
 * What calls it: Vitest.
 * What it calls: `requirePermission` from the validation layer.
 * Junior gotcha: Testing only the happy path would miss a real authorization bug that ships to production.
 */
import { describe, expect, it } from "vitest";
import { AuthorizationError, requirePermission } from "@/lib/validation";

describe("requirePermission", () => {
  it("rejects a viewer trying to approve a purchase order", () => {
    // This test protects the boundary where a UI-only check would otherwise let an unauthorized action reach the API.
    expect(() =>
      requirePermission({ membershipRole: "VIEWER", platformRole: "USER" }, "purchaseOrder.approve"),
    ).toThrowError(AuthorizationError);
  });

  it("allows a procurement manager to approve a purchase order", () => {
    expect(
      requirePermission(
        { membershipRole: "PROCUREMENT_MANAGER", platformRole: "USER" },
        "purchaseOrder.approve",
      ),
    ).toBe(true);
  });
});

// ⚠️ SENIOR NOTE: If this test ever starts passing without the guard throwing on the forbidden path, the API is probably no longer protected.
