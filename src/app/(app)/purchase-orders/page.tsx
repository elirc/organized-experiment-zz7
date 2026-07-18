/*
What this file does: Renders the purchase orders route inside the authenticated shell.
What calls it: Next.js for `/purchase-orders`.
What it calls: `@/components/purchase-orders/purchase-orders-page`.
What a junior would likely get wrong: Embedding status logic here instead of in the feature component and leaving the route file as dead glue.
*/
import { PurchaseOrdersPage } from "@/components/purchase-orders/purchase-orders-page";

export default function Page() {
  return <PurchaseOrdersPage />;
}
