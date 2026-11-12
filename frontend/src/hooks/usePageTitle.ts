import { useEffect } from "react";

/** Título del documento por pantalla (WCAG 2.4.2). */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · AQP-SOLIDARIA`;
  }, [title]);
}
