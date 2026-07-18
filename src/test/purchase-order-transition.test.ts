/**
 * What this file does: Guards the purchase-order state machine against invalid jumps.
 * What calls it: Vitest.
 * What it calls: `assertPurchaseOrderStatusTransition`.
 * Junior gotcha: A loose state machine can skip approval and create an accounting hole that is hard to unwind.
 */
import { describe, expect, it } from "vitest";
import { assertPurchaseOrderStatusTransition } from "@/lib/validation";

describe("purchase order transitions", () => {
  it("rejects a direct jump from draft to received", () => {
    // This catches the class of bug where a receiving flow bypasses approval and audit controls.
    expect(() => assertPurchaseOrderStatusTransition("DRAFT", "RECEIVED")).toThrowError(
      "Invalid purchase order transition from DRAFT to RECEIVED",
    );
  });

  it("allows approval before receiving", () => {
    expect(assertPurchaseOrderStatusTransition("PENDING_APPROVAL", "APPROVED")).toBe(true);
  });
});

// ⚠️ SENIOR NOTE: This map is business logic, not just validation, so any status change here needs a workflow review.
