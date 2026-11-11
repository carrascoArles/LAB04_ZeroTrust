import { useId, type ComponentProps, type ReactNode } from "react";

const CONTROL =
  "mt-1 block w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-base text-slate-900 aria-invalid:border-red-700 aria-invalid:ring-1 aria-invalid:ring-red-700";

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: (describedBy: string | undefined) => ReactNode;
}

/**
 * Etiqueta, ayuda y error ligados al control con `aria-describedby` (WCAG 1.3.1, 3.3.1 y 3.3.2).
 * El error se anuncia al aparecer.
 */
function FieldShell({ id, label, hint, error, required, children }: Readonly<FieldShellProps>) {
  const hintId = hint ? `${id}-ayuda` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="block font-medium text-slate-900">
        {label}
        {required && <span className="text-red-800"> (obligatorio)</span>}
      </label>
      {children(describedBy)}
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-slate-700">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

interface CommonProps {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextField({
  label,
  hint,
  error,
  id,
  required,
  ...input
}: Readonly<CommonProps & ComponentProps<"input">>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      {(describedBy) => (
        <input
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={CONTROL}
          {...input}
        />
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  id,
  required,
  ...textarea
}: Readonly<CommonProps & ComponentProps<"textarea">>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      {(describedBy) => (
        <textarea
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={`${CONTROL} min-h-32`}
          {...textarea}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  id,
  required,
  children,
  ...select
}: Readonly<CommonProps & ComponentProps<"select">>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      {(describedBy) => (
        <select
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={`${CONTROL} min-h-11`}
          {...select}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}
