/*
What this file does: Shows structured empty states instead of leaving whitespace in lists and tables.
What calls it: Section pages when filters or mock data produce no visible rows.
What it calls: `Button` for the next step action.
What a junior would likely get wrong: Treating empty states as an afterthought and skipping the user guidance.
*/
import type { ReactNode } from "react";
import { Button } from "./button";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="glass-panel rounded-3xl border border-dashed border-white/12 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-sky-200">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
        {description}
      </p>
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
