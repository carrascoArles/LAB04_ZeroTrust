import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Copia de la response headers policy de CloudFront (`SecurityHeadersPolicy` en
 * infra/template.yaml, región us-east-2). `npm run preview` sirve el build con estas mismas
 * cabeceras para detectar en local cualquier violación de la CSP antes de publicar.
 */
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://*.execute-api.us-east-2.amazonaws.com https://cognito-idp.us-east-2.amazonaws.com https://*.auth.us-east-2.amazoncognito.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// Cognito y el CORS del API solo aceptan este puerto en desarrollo (infra/template.yaml).
const LOCAL_PORT = 5173;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: LOCAL_PORT, strictPort: true },
  preview: {
    port: LOCAL_PORT,
    strictPort: true,
    headers: {
      "Content-Security-Policy": PRODUCTION_CSP,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  build: {
    sourcemap: false,
    // Las bibliotecas cambian poco: en archivos aparte, el navegador las conserva en caché
    // entre publicaciones aunque cambie el código de la SPA.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
              priority: 2,
            },
            { name: "vendor", test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    // Valores ficticios: las pruebas nunca llaman a AWS.
    env: {
      VITE_API_URL: "https://api.example.test/academic",
      VITE_COGNITO_DOMAIN: "https://auth.example.test",
      VITE_USER_POOL_ID: "us-east-2_TestPool1",
      VITE_CLIENT_ID: "test-client-id",
      VITE_REDIRECT_URI: "",
    },
  },
});
