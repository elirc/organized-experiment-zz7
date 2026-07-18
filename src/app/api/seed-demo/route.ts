/**
 * What this file does:
 * Seeds a realistic demo dataset with multiple tenants and roles.
 * What calls it:
 * `src/components/auth/login-page.tsx`.
 * What it calls:
 * `src/services/seedDemoService.ts`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Hiding demo seeding in a script only, which makes the app harder to evaluate from the browser.
 */
import { jsonOk, withPublicRoute } from "@/lib/http/route";
import { seedDemoService } from "@/services/seedDemoService";

export const POST = withPublicRoute(async () => {
  const result = await seedDemoService.seed();
  return jsonOk(result);
});

// ⚠️ SENIOR NOTE: Browser-triggered seeding is acceptable in a demo app, but production systems should gate this behind
// environment-specific protections so setup endpoints cannot exist accidentally in live environments.
