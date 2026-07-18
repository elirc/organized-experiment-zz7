/*
What this file does: Renders the login surface, seeds demo data, and establishes a session through the real auth route.
What calls it: `src/app/login/page.tsx`.
What it calls: `/api/seed-demo`, `/api/auth/login`, and shared UI primitives.
What a junior would likely get wrong: Faking login locally in component state instead of teaching the actual request flow.
*/
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card";

type SeedResponse = {
  alreadySeeded: boolean;
  credentials: Array<{
    email: string;
    organizationSlug: string;
    password: string;
    role: string;
  }>;
};

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("olivia@acme.test");
  const [password, setPassword] = useState("ProcureFlow123!");
  const [organizationSlug, setOrganizationSlug] = useState("acme-industrial");
  const [message, setMessage] = useState<string | null>(null);
  const [seedInfo, setSeedInfo] = useState<SeedResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSeedDemo() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/seed-demo", {
        method: "POST",
      });
      const result = (await response.json()) as SeedResponse;
      setSeedInfo(result);

      if (result.credentials[0]) {
        setEmail(result.credentials[0].email);
        setPassword(result.credentials[0].password);
        setOrganizationSlug(result.credentials[0].organizationSlug);
      }

      setMessage(result.alreadySeeded ? "Demo workspace already seeded." : "Demo workspace created.");
    } catch {
      setMessage("Unable to seed demo data.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({
          email,
          organizationSlug,
          password,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "Login failed.");
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="glass-panel rounded-[32px] p-8 lg:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-200/75">VendorOS</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
            Procurement operations with reporting built in.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            Buyers, approvers, analysts, and AP clerks share one workspace for RFQs,
            purchase orders, receiving, discrepancies, and saved reports.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Badge tone="sky">Approvals</Badge>
            <Badge tone="emerald">Receiving</Badge>
            <Badge tone="amber">Analytics exports</Badge>
          </div>

          <div className="mt-8 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Use demo seeding once, then log in with one of the seeded tenant-role combinations.
            </div>
            {seedInfo ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Seeded credentials</p>
                <div className="mt-3 space-y-2">
                  {seedInfo.credentials.map((credential) => (
                    <button
                      key={`${credential.email}-${credential.organizationSlug}`}
                      type="button"
                      onClick={() => {
                        setEmail(credential.email);
                        setPassword(credential.password);
                        setOrganizationSlug(credential.organizationSlug);
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-left transition hover:bg-slate-950/70"
                    >
                      <p className="font-medium text-white">{credential.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                        {credential.organizationSlug} • {credential.role}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <Card className="rounded-[32px] p-8">
          <CardHeader>
            <div>
              <CardEyebrow>Sign in</CardEyebrow>
              <CardTitle>Access the operations console</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.28em] text-slate-400">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300/40"
                  type="email"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.28em] text-slate-400">Password</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                  type="password"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.28em] text-slate-400">Workspace slug</span>
                <input
                  value={organizationSlug}
                  onChange={(event) => setOrganizationSlug(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/40"
                  type="text"
                />
              </label>

              <Button className="w-full py-3 text-base" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Enter workspace"}
              </Button>
            </form>

            <Button
              className="w-full"
              variant="secondary"
              type="button"
              onClick={handleSeedDemo}
              disabled={isSubmitting}
            >
              Seed demo workspace
            </Button>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              {message ?? "Use the demo seed to create two tenants and several roles before signing in."}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ⚠️ SENIOR NOTE: Login uses the real auth route and server-set cookie. Replacing this with client-only fake auth
      would teach the wrong request flow and hide cookie/session bugs. */}
    </div>
  );
}
