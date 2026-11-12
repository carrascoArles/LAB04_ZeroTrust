import { z } from "zod";

/**
 * La CSP de CloudFront no permite 'unsafe-eval'. Sin esta opción, Zod prueba `new Function` al
 * crear cada esquema y el navegador registra una violación de la CSP. Este módulo debe
 * importarse antes que cualquier esquema (primera línea de main.tsx).
 */
z.config({ jitless: true });
