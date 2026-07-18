/**
 * What this file does: Holds shared Vitest setup for unit tests in `src/test`.
 * What calls it: Vitest via `vitest.config.ts`.
 * What it calls: Test-library matchers when we add DOM-oriented tests later.
 * Junior gotcha: Over-configuring the setup file early can hide missing imports instead of fixing them.
 */
import "@testing-library/jest-dom";

// ⚠️ SENIOR NOTE: Keep this file intentionally thin so it does not become a hidden second test framework.
