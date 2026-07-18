/*
What this file does: Renders the sourcing route inside the authenticated shell.
What calls it: Next.js for `/sourcing`.
What it calls: `@/components/sourcing/sourcing-page`.
What a junior would likely get wrong: Repeating the same sourcing layout in multiple route files instead of a single component.
*/
import { SourcingPage } from "@/components/sourcing/sourcing-page";

export default function Page() {
  return <SourcingPage />;
}
