/**
 * What this file does: Re-exports the validation boundary for convenient imports.
 * What calls it: Route handlers, services, and tests.
 * What it calls: The individual schema modules.
 * Junior gotcha: Importing internals from many places makes the validation boundary harder to audit.
 */
export * from "./common";
export * from "./authSchemas";
export * from "./vendorSchemas";
export * from "./rfqSchemas";
export * from "./purchaseOrderSchemas";
export * from "./reportSchemas";
