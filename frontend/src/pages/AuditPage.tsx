import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../components/Button";
import { ErrorMessage } from "../components/ErrorMessage";
import { SelectField, TextField } from "../components/Field";
import { Loading } from "../components/Loading";
import { RequireRole } from "../components/RequireRole";
import { AUDIT_EVENT_TYPES, countLabel, formatDateTime } from "../domain/labels";
import { useAuditEvents } from "../hooks/queries";
import { usePageTitle } from "../hooks/usePageTitle";
import type { AuditFilters } from "../services/audit";

/** `datetime-local` usa la hora local del navegador; el API espera ISO 8601 con zona. */
const localToIso = (value: string) => (value ? new Date(value).toISOString() : undefined);

const filtersSchema = z
  .object({
    eventType: z.string().min(1, "Elige un tipo de evento."),
    from: z.string(),
    to: z.string(),
  })
  .refine(({ from, to }) => !from || !to || new Date(from) <= new Date(to), {
    path: ["to"],
    message: "La fecha final debe ser posterior a la inicial.",
  });

type FiltersForm = z.infer<typeof filtersSchema>;

function AuditFiltersForm({ onSearch }: Readonly<{ onSearch: (filters: AuditFilters) => void }>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FiltersForm>({
    resolver: zodResolver(filtersSchema),
    defaultValues: { eventType: AUDIT_EVENT_TYPES[0].value, from: "", to: "" },
  });

  const submit = handleSubmit(({ eventType, from, to }) =>
    onSearch({ eventType, from: localToIso(from), to: localToIso(to) }),
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-3">
      <SelectField
        label="Tipo de evento"
        required
        error={errors.eventType?.message}
        {...register("eventType")}
      >
        {AUDIT_EVENT_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Desde"
        type="datetime-local"
        error={errors.from?.message}
        {...register("from")}
      />
      <TextField
        label="Hasta"
        type="datetime-local"
        error={errors.to?.message}
        {...register("to")}
      />
      <div className="sm:col-span-3">
        <Button type="submit">Consultar eventos</Button>
      </div>
    </form>
  );
}

function AuditResults({ filters }: Readonly<{ filters: AuditFilters }>) {
  const events = useAuditEvents(filters);

  if (events.isPending) return <Loading label="Consultando eventos…" />;
  if (events.isError) {
    return <ErrorMessage error={events.error} onRetry={() => void events.refetch()} />;
  }
  if (events.data.length === 0) {
    return <p className="text-slate-700">No hay eventos para este filtro.</p>;
  }
  return (
    <>
      <output className="block text-sm text-slate-700">
        {countLabel(events.data.length, "evento", "eventos")} (máximo 200, del más reciente al más
        antiguo).
      </output>
      {/* Región enfocable: en 375 px la tabla se desplaza también con el teclado. */}
      <div
        role="region"
        aria-label="Eventos de auditoría"
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-slate-300 bg-white"
      >
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">Eventos de auditoría con actor seudonimizado</caption>
          <thead className="bg-slate-100 text-slate-900">
            <tr>
              {["Fecha", "Acción", "Actor", "Recurso", "Resultado", "requestId"].map((header) => (
                <th key={header} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {events.data.map((event) => (
              <tr key={event.eventId}>
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(event.timestamp)}</td>
                <td className="px-3 py-2">{event.action}</td>
                <td className="px-3 py-2 font-mono text-xs">{event.actorRef}</td>
                <td className="px-3 py-2 font-mono text-xs break-all">{event.resourceRef}</td>
                <td className="px-3 py-2">{event.outcome}</td>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{event.requestId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Consulta de auditoría (HU-10, extensión). Solo AUDITOR. */
export function AuditPage() {
  usePageTitle("Auditoría");
  const [filters, setFilters] = useState<AuditFilters | null>(null);
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Auditoría</h1>
        <p className="text-slate-700">
          Acciones críticas con el actor seudonimizado. No incluye tokens ni datos financieros.
        </p>
      </div>
      <RequireRole role="AUDITOR">
        <AuditFiltersForm onSearch={setFilters} />
        {filters && <AuditResults filters={filters} />}
      </RequireRole>
    </>
  );
}
