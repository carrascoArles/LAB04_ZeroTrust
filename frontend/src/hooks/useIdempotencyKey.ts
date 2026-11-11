import { useCallback, useRef } from "react";

interface Attempt {
  key: string;
  fingerprint: string;
}

/**
 * Clave de idempotencia por intento de donación (CA-05.4, research.md F8):
 * - un envío nuevo recibe `crypto.randomUUID()`;
 * - reenviar la misma carga tras un fallo reutiliza la clave, así el backend no duplica (T06);
 * - cambiar la carga genera otra clave, para no recibir 409 por clave reutilizada (T07);
 * - tras un éxito, la siguiente donación empieza con una clave nueva.
 */
export function useIdempotencyKey<T>() {
  const attempt = useRef<Attempt | null>(null);

  const keyFor = useCallback((payload: T): string => {
    const fingerprint = JSON.stringify(payload);
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { key: crypto.randomUUID(), fingerprint };
    }
    return attempt.current.key;
  }, []);

  const settle = useCallback(() => {
    attempt.current = null;
  }, []);

  return { keyFor, settle };
}
