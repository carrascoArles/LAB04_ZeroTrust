import { useId } from "react";
import { formatCents, progressPercent } from "../domain/money";

interface FundingProgressProps {
  confirmedCents: number;
  goalCents: number;
}

/**
 * Avance confirmado (HU-09). `<progress>` nativo: accesible y sin estilos en línea, que la CSP
 * de CloudFront bloquearía.
 */
export function FundingProgress({ confirmedCents, goalCents }: Readonly<FundingProgressProps>) {
  const labelId = useId();
  const percent = progressPercent(confirmedCents, goalCents);
  return (
    <div>
      <p id={labelId} className="text-sm text-slate-800">
        <span className="font-semibold text-slate-900">{formatCents(confirmedCents)}</span>{" "}
        confirmados de {formatCents(goalCents)} ({percent} %)
      </p>
      <progress
        aria-labelledby={labelId}
        max={100}
        value={percent}
        className="mt-2 block h-3 w-full appearance-none overflow-hidden rounded-full bg-slate-200 [&::-moz-progress-bar]:bg-emerald-700 [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-emerald-700"
      >
        {percent} %
      </progress>
    </div>
  );
}
