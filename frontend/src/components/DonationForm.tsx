import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DONATION_STATUS_LABEL } from "../domain/labels";
import { checkDonationAmount, formatCents } from "../domain/money";
import { useCreateDonation } from "../hooks/queries";
import { useIdempotencyKey } from "../hooks/useIdempotencyKey";
import type { CreateDonationRequest, Donation } from "../services/schemas";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { ErrorMessage } from "./ErrorMessage";
import { TextField } from "./Field";
import { SimulationPanel } from "./SimulationPanel";

/** El texto del monto se convierte a céntimos enteros al validar (CA-05.1, research.md F7). */
const formSchema = z.object({
  amount: z.string().transform((text, ctx) => {
    const check = checkDonationAmount(text);
    if (!check.ok) {
      ctx.addIssue({ code: "custom", message: check.message });
      return z.NEVER;
    }
    return check.cents;
  }),
});

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

const SUGGESTED_AMOUNTS = ["10", "20", "50"];

/** Intención de donación simulada (HU-05), solo para DONANTE. */
export function DonationForm({ projectId }: Readonly<{ projectId: string }>) {
  const createDonation = useCreateDonation();
  const idempotency = useIdempotencyKey<CreateDonationRequest>();
  const [created, setCreated] = useState<Donation | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: "" },
  });

  const submit = handleSubmit(({ amount }) => {
    const input: CreateDonationRequest = { projectId, amountCents: amount };
    createDonation.mutate(
      { input, idempotencyKey: idempotency.keyFor(input) },
      {
        onSuccess: (donation) => {
          idempotency.settle();
          setCreated(donation);
          reset();
        },
      },
    );
  });

  const startOver = () => {
    setCreated(null);
    createDonation.reset();
  };

  if (created) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Intención de donación registrada">
          <p>
            Registramos {formatCents(created.amountCents)} con estado «
            {DONATION_STATUS_LABEL[created.status]}». Ahora puedes simular su resultado.
          </p>
        </Alert>
        <SimulationPanel donation={created} />
        <Button variant="secondary" onClick={startOver}>
          Registrar otra donación
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField
        label="Monto en soles (S/)"
        inputMode="decimal"
        autoComplete="off"
        required
        hint="Entre S/ 1.00 y S/ 1,000.00. Usa punto o coma para los céntimos, por ejemplo 19.99."
        error={errors.amount?.message}
        {...register("amount")}
      />

      <fieldset>
        <legend className="text-sm text-slate-800">Montos sugeridos</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {SUGGESTED_AMOUNTS.map((amount) => (
            <Button
              key={amount}
              variant="secondary"
              onClick={() => setValue("amount", amount, { shouldValidate: true })}
            >
              S/ {amount}
            </Button>
          ))}
        </div>
      </fieldset>

      <p className="text-sm text-slate-700">
        No ingreses datos de tarjeta ni bancarios: esta plataforma no procesa pagos.
      </p>

      {createDonation.isError && (
        <ErrorMessage
          error={createDonation.error}
          onRetry={() => void submit()}
          retryLabel="Reintentar el envío"
        />
      )}

      <Button type="submit" busy={createDonation.isPending}>
        Registrar intención de donación
      </Button>
    </form>
  );
}
