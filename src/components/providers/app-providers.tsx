/*
What this file does: Installs client-side providers used by the app shell and future data hooks.
What calls it: `src/app/layout.tsx`.
What it calls: React Query provider/devtools.
What a junior would likely get wrong: Mounting a new query client on every render and losing cache state.
*/
"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV !== "production" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}

// ⚠️ SENIOR NOTE: The query client is created once with `useState` so cache survives re-renders. Recreating it in render would silently wipe query state across the app.
