/*
What this file does: Renders the reports route inside the authenticated shell.
What calls it: Next.js for `/reports`.
What it calls: `@/components/reports/reports-page`.
What a junior would likely get wrong: Treating the route as a data fetch endpoint instead of a thin view wrapper.
*/
import { ReportsPage } from "@/components/reports/reports-page";

export default function Page() {
  return <ReportsPage />;
}
