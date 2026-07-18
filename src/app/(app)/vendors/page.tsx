/*
What this file does: Renders the vendors route inside the authenticated shell.
What calls it: Next.js for `/vendors`.
What it calls: `@/components/vendors/vendors-page`.
What a junior would likely get wrong: Putting the entire screen logic in the route file and making the page hard to reuse.
*/
import { VendorsPage } from "@/components/vendors/vendors-page";

export default function Page() {
  return <VendorsPage />;
}
