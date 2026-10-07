# VendorOS (zz7)

A multi-tenant procurement app: vendors, RFQs and quotes, purchase orders with approval and receiving, saved reports, and export jobs. Next.js 16 App Router, React 19, Prisma 6 on PostgreSQL, Zod 3, React Query 5, Vitest 3 (`package.json:14-42`). The package name is `zz7`; the UI calls itself VendorOS (`src/app/layout.tsx:24`) and the session cookie is `procureflow_session` (`src/lib/auth/session.ts:16`).

## Running it

Nothing below was executed for this documentation pass (no installs or builds were allowed). The steps are derived from the files named.

1. `npm install`.
2. Create `.env` with `DATABASE_URL` (PostgreSQL) and `SESSION_SECRET`. There is no `.env.example`. If `SESSION_SECRET` is unset, a fixed development secret is used silently (`src/lib/env.ts:15-16`).
3. `npx prisma db push`. The repo has `prisma/schema.prisma` but **no `prisma/migrations/` folder**, so `prisma migrate deploy` has nothing to apply. `npm run prisma:generate` only generates the client.
4. `npm run dev`, open `http://localhost:3000/login`, and click **Seed demo workspace**. That calls `POST /api/seed-demo` (`src/components/auth/login-page.tsx:35-58`).
5. Sign in. The form is prefilled with `olivia@acme.test` / `ProcureFlow123!` / `acme-industrial` (`login-page.tsx:28-30`).

| Seeded login | Organization slug | Role |
|---|---|---|
| `olivia@acme.test` | `acme-industrial` | `ORG_ADMIN` |
| `marco@acme.test` | `acme-industrial` | `PROCUREMENT_MANAGER` |
| `erin@blueorbit.test` | `blue-orbit-foods` | `ANALYST` |

All three use `ProcureFlow123!` (`src/services/seedDemoService.ts:14`).

**Warning:** `POST /api/seed-demo` needs no login and, once the data exists, returns these credentials to any caller (`seedDemoService.ts:22-30`). Do not deploy it as is. See `docs/architecture/auth-and-permissions.md`.

## Scripts

| Script | Command | Note |
|---|---|---|
| `dev` | `next dev` | |
| `build` / `start` | `next build` / `next start` | |
| `lint` | `eslint .` | |
| `test` | `vitest` | watch mode in an interactive terminal; runs once in CI |
| `test:run` | `vitest run` | runs `src/test/**/*.test.ts` once (`vitest.config.ts:18`) |
| `prisma:generate` | `prisma generate` | |

The four test files cover pure helpers only (permission matrix, PO transition map, an unused tenant guard, three Zod schemas). No test touches a route, a service, or the database. See `docs/learning/testing-rationale.md`.

## What works from the UI and what does not

From the browser you can seed, log in, log out, and *view* vendors, sourcing, purchase orders, reports, and the dashboard. Every create, approve, receive, queue-export, and run-export action exists only as an API route; there is no form or button for them. The reports page's "Queue export" button only logs to the console (`src/components/reports/reports-page.tsx:168-174`). When an API call fails, including with 403, the pages show hard-coded sample data instead of an error (`src/hooks/use-*-data.ts`).

## Documentation map

| Doc | Read it for |
|---|---|
| `docs/architecture/README.md` | layers, verified absences, defect index |
| `docs/architecture/auth-and-permissions.md` | login, session resolution, every route's gate, permission matrix, findings |
| `docs/architecture/domain-model.md` | models, state machines, invariants, seed contents |
| `docs/architecture/request-lifecycle.md` | line-anchored traces, status codes, concurrency |
| `docs/learning/guided-reading-path.md` | reading order with exercises and answers |
| `docs/learning/testing-rationale.md` | what the tests prove, dependency-free checks to write, tests to add |

---

The rest of this file is the original `create-next-app` README, kept for reference.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

**Correction:** in this repo the file is `src/app/page.tsx`, and it requires a session: without one it redirects to `/login` (`src/app/page.tsx:12`, `src/lib/auth/page-session.ts:21-29`).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
