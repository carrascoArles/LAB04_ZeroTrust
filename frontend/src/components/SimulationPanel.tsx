import { DONATION_STATUS_LABEL, SIMULATION_NOTICE } from "../domain/labels";
import { formatCents } from "../domain/money";
import { useSimulateDonation } from "../hooks/queries";
import type { Donation, SimulationOutcome } from "../services/schemas";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { ErrorMessage } from "./ErrorMessage";

/**
 * Simulación de una donación propia (HU-06). El resultado lo elige el donante (CA-06.1) y el
 * backend aplica una sola transición desde PENDIENTE_SIMULACION.
 */
export function SimulationPanel({ donation }: Readonly<{ donation: Donation }>) {
  const simulate = useSimulateDonation();
  const current = simulate.data ?? donation;
  const isPending = current.status === "PENDIENTE_SIMULACION";

  const run = (outcome: SimulationOutcome) =>
    simulate.mutate({ donationId: current.donationId, outcome });
  const isRunning = (outcome: SimulationOutcome) =>
    simulate.isPending && simulate.variables?.outcome === outcome;

  return (
    <div className="space-y-3 rounded-md border border-amber-400 bg-amber-50 p-4">
      <p className="font-semibold text-amber-950">{SIMULATION_NOTICE}</p>

      {isPending ? (
        <>
          <p className="text-slate-800">
            Elige el resultado simulado de tu intención de {formatCents(current.amountCents)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => run("CONFIRMADA_SIMULADA")}
              busy={isRunning("CONFIRMADA_SIMULADA")}
              disabled={simulate.isPending}
            >
              Simular confirmación
            </Button>
            <Button
              variant="danger"
              onClick={() => run("RECHAZADA_SIMULADA")}
              busy={isRunning("RECHAZADA_SIMULADA")}
              disabled={simulate.isPending}
            >
              Simular rechazo
            </Button>
          </div>
        </>
      ) : (
        simulate.isSuccess && (
          <Alert
            tone={current.status === "CONFIRMADA_SIMULADA" ? "success" : "warning"}
            title={`Resultado: ${DONATION_STATUS_LABEL[current.status]}`}
          >
            <p>
              {current.status === "CONFIRMADA_SIMULADA"
                ? "El monto confirmado del proyecto ya incluye esta donación."
                : "El monto confirmado del proyecto no cambió."}
            </p>
          </Alert>
        )
      )}

      {simulate.isError && <ErrorMessage error={simulate.error} />}
    </div>
  );
}
