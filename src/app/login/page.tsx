/*
What this file does: Renders the login route.
What calls it: Next.js for `/login`.
What it calls: `@/components/auth/login-page`.
What a junior would likely get wrong: Adding app shell navigation to a login screen and making the authentication boundary unclear.
*/
import { LoginPage } from "@/components/auth/login-page";

export default function Page() {
  return <LoginPage />;
}
