import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-700/60",
  secondary:
    "border border-slate-400 bg-white text-slate-900 hover:bg-slate-100 disabled:text-slate-500",
  danger: "border border-red-700 bg-white text-red-800 hover:bg-red-50 disabled:text-red-800/60",
};

function buttonClass(variant: Variant): string {
  // min-h-11: objetivo táctil de 44 px (WCAG 2.5.8).
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 font-semibold transition-[color,background-color,border-color] disabled:cursor-not-allowed ${VARIANTS[variant]}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Deshabilita el botón y anuncia que la acción está en curso. */
  busy?: boolean;
}

export function Button({
  variant = "primary",
  busy = false,
  type = "button",
  disabled,
  className = "",
  children,
  ...props
}: Readonly<ButtonProps>) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`${buttonClass(variant)} ${className}`}
      {...props}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
