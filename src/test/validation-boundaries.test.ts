/**
 * What this file does: Proves the Zod boundary rejects malformed vendor, RFQ, and report inputs.
 * What calls it: Vitest.
 * What it calls: The vendor, RFQ, and report schemas.
 * Junior gotcha: A schema that only accepts the happy path is just documentation, not protection.
 */
import { describe, expect, it } from "vitest";
import { reportDefinitionSchema, rfqCreateSchema, vendorCreateSchema } from "@/lib/validation";

describe("validation boundaries", () => {
  it("rejects a malformed vendor create payload", () => {
    // This catches front-end drift where a human-friendly form can still send junk the database should never see.
    const result = vendorCreateSchema.safeParse({
      name: "  ",
      code: "bad code!",
      status: "ACTIVE",
      paymentTerms: "",
      country: "US",
      contactEmail: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an RFQ without line items", () => {
    const result = rfqCreateSchema.safeParse({
      title: "Office supplies",
      description: "Monthly office order",
      lineItems: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a report definition with duplicate dimensions and inverted dates", () => {
    const result = reportDefinitionSchema.safeParse({
      name: "Spend by vendor",
      description: "A saved finance view",
      reportType: "PROCUREMENT_SPEND",
      dimensions: ["vendor", "vendor"],
      metrics: ["totalSpend"],
      filters: {
        dateFrom: "2026-04-10",
        dateTo: "2026-04-01",
      },
    });

    expect(result.success).toBe(false);
  });
});

// ⚠️ SENIOR NOTE: If any of these payloads starts parsing, the API boundary has widened without a corresponding review.
