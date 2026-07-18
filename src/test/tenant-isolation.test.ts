/**
 * What this file does: Verifies tenant mismatch is rejected before data access could cross org boundaries.
 * What calls it: Vitest.
 * What it calls: `assertTenantScope`.
 * Junior gotcha: Returning a generic "not found" from the wrong layer can hide the fact that scoping was skipped entirely.
 */
import { describe, expect, it } from "vitest";
import { AuthorizationError, assertTenantScope } from "@/lib/validation";

describe("tenant isolation", () => {
  it("rejects a cross-tenant access attempt", () => {
    // This guards the repository boundary we expect later: a resource must not be readable outside the current tenant.
    expect(() => assertTenantScope("tenant_a", "tenant_b")).toThrowError(AuthorizationError);
  });

  it("allows access when the tenant matches", () => {
    expect(assertTenantScope("tenant_a", "tenant_a")).toBe(true);
  });
});

// ⚠️ SENIOR NOTE: This is the last cheap place to stop a leak; if repositories omit the tenant filter later, the tests need to fail loudly.
