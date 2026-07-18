/*
What this file does: Wraps dashboard content in a consistent panel treatment.
What calls it: The dashboard and section pages in `src/components/**`.
What it calls: Nothing beyond React rendering.
What a junior would likely get wrong: Recreating the same border/radius/shadow combinations in every page component.
*/
import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("glass-panel rounded-3xl p-5", className)} {...props} />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("mb-4 flex items-start justify-between gap-4", className)} {...props} />
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-semibold text-white">{children}</h3>;
}

export function CardEyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{children}</p>;
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("space-y-4", className)} {...props} />;
}
