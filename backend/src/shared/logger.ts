export interface RequestLog {
  requestId: string;
  action: string;
  route: string;
  status: number;
  outcome: "SUCCESS" | "REJECTED" | "ERROR";
  durationMs: number;
  errorName?: string;
}

/**
 * Único punto de log de la aplicación. Recibe solo campos de esta lista: nunca el evento,
 * el cuerpo, las cabeceras, los claims ni el mensaje de una excepción (CA-NF01.2).
 */
export function logRequest(entry: RequestLog): void {
  console.log(JSON.stringify(entry));
}
