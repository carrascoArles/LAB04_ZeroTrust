/**
 * Dinero en céntimos enteros de PEN (constitución, principio IV). Nunca se multiplica un
 * decimal: `19.99 * 100` da `1998.9999…` y el API responde 400.
 */

/** Límites de `CreateDonationRequest.amountCents` en docs/api.yaml. */
export const MIN_DONATION_CENTS = 100;
export const MAX_DONATION_CENTS = 100_000;

/** Soles con punto o coma decimal y hasta dos decimales: 20, 19.9, 19,99. Sin separador de miles. */
const AMOUNT_PATTERN = /^(\d{1,9})(?:[.,](\d{1,2}))?$/;

/** Convierte el texto a céntimos sumando enteros. Devuelve null si el formato no es válido. */
export function parseSolesToCents(text: string): number | null {
  const match = AMOUNT_PATTERN.exec(text.trim());
  if (!match) return null;
  const soles = Number.parseInt(match[1] ?? "0", 10);
  const centimos = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10);
  return soles * 100 + centimos;
}

export type AmountCheck = { ok: true; cents: number } | { ok: false; message: string };

export function checkAmount(text: string, minCents: number, maxCents?: number): AmountCheck {
  if (text.trim() === "") return { ok: false, message: "Escribe un monto." };
  const cents = parseSolesToCents(text);
  if (cents === null) {
    return {
      ok: false,
      message: "Usa solo números, con hasta dos decimales y sin separador de miles. Ejemplo: 19.99",
    };
  }
  if (cents < minCents) {
    return { ok: false, message: `El monto mínimo es ${formatCents(minCents)}.` };
  }
  if (maxCents !== undefined && cents > maxCents) {
    return { ok: false, message: `El monto máximo es ${formatCents(maxCents)}.` };
  }
  return { ok: true, cents };
}

export function checkDonationAmount(text: string): AmountCheck {
  return checkAmount(text, MIN_DONATION_CENTS, MAX_DONATION_CENTS);
}

const THOUSANDS = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Formato peruano de soles a partir de céntimos, sin pasar por decimales: 123456 → "S/ 1,234.56". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const soles = Math.trunc(absolute / 100);
  const centimos = absolute % 100;
  return `${sign}S/ ${THOUSANDS.format(soles)}.${String(centimos).padStart(2, "0")}`;
}

/** Porcentaje entero de avance, acotado a 0–100. */
export function progressPercent(confirmedCents: number, goalCents: number): number {
  if (goalCents <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((confirmedCents * 100) / goalCents)));
}
