import type { ReactNode } from "react";

type Tone = "error" | "success" | "info" | "warning";

const TONES: Record<Tone, string> = {
  error: "border-red-700 bg-red-50 text-red-900",
  success: "border-emerald-700 bg-emerald-50 text-emerald-900",
  info: "border-sky-700 bg-sky-50 text-sky-900",
  warning: "border-amber-600 bg-amber-50 text-amber-900",
};

interface AlertProps {
  tone: Tone;
  title: string;
  children?: ReactNode;
}

/** Los errores se anuncian de inmediato (`alert`); el resto, sin interrumpir (`status`). */
export function Alert({ tone, title, children }: Readonly<AlertProps>) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border-l-4 p-4 ${TONES[tone]}`}
    >
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 space-y-2">{children}</div>}
    </div>
  );
}
