/*
What this file does: Renders status and role chips with a small variant vocabulary.
What calls it: List rows, cards, and shell chrome across feature pages.
What it calls: `clsx` for color mapping.
What a junior would likely get wrong: Using raw text labels for status and leaving the UI visually ambiguous.
*/
import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

type Tone = "sky" | "emerald" | "amber" | "rose" | "slate";

const toneStyles: Record<Tone, string> = {
  sky: "bg-sky-500/15 text-sky-200 ring-sky-400/20",
  emerald: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20",
  amber: "bg-amber-500/15 text-amber-200 ring-amber-400/20",
  rose: "bg-rose-500/15 text-rose-200 ring-rose-400/20",
  slate: "bg-slate-500/15 text-slate-200 ring-slate-400/20",
};

export function Badge({
  tone = "slate",
  className,
  children,
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
