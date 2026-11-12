// Genera un bundle por handler en dist/, con la ruta que espera infra/template.yaml.
import { rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const handlers = [
  "projects/list",
  "projects/get",
  "projects/stats",
  "projects/create",
  "projects/publish",
  "donations/create",
  "donations/simulate",
  "donations/me",
  "donations/get",
  "audit/list",
];

await rm("dist", { recursive: true, force: true });
await build({
  entryPoints: handlers.map((h) => `src/${h}.ts`),
  outbase: "src",
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  minify: true,
  legalComments: "none",
  logLevel: "info",
});

// Los bundles son CommonJS aunque este paquete sea ESM.
await writeFile("dist/package.json", JSON.stringify({ type: "commonjs" }));
