/*
What this file does: Provides the shared button style used across the app shell and forms.
What calls it: Page and form components in `src/components/**`.
What it calls: `clsx` for variant composition.
What a junior would likely get wrong: Baking one-off Tailwind strings into each page and making later visual changes brittle.
*/
import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

const buttonStyles = {
  primary:
    "bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/20 hover:bg-sky-300",
  secondary:
    "border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10",
  ghost:
    "text-slate-300 hover:bg-white/5 hover:text-white",
};

type ButtonVariant = keyof typeof buttonStyles;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300",
        buttonStyles[variant],
        className
      )}
      {...props}
    />
  );
}
