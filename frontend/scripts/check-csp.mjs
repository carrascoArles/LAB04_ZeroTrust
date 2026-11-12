// Comprueba que el build cumple la CSP de CloudFront (CA-NF11.2): sin scripts ni estilos en
// línea y sin recursos de otros dominios. Se ejecuta al final de `npm run build`.
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

/** @param {string} dir @returns {Promise<string[]>} */
async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? listFiles(path) : Promise.resolve([path]);
    }),
  );
  return nested.flat();
}

/** @type {Array<{ extension: string, pattern: RegExp, problem: string }>} */
const RULES = [
  {
    extension: ".html",
    pattern: /<script(?![^>]*\bsrc=)[^>]*>/gi,
    problem: "script en línea (script-src 'self')",
  },
  { extension: ".html", pattern: /<style\b/gi, problem: "estilo en línea (style-src 'self')" },
  { extension: ".html", pattern: /\sstyle\s*=/gi, problem: "atributo style (style-src 'self')" },
  { extension: ".html", pattern: /\son[a-z]+\s*=/gi, problem: "manejador de evento en línea" },
  {
    extension: ".html",
    pattern: /\s(?:src|href)\s*=\s*["']?(?:https?:)?\/\//gi,
    problem: "recurso de otro dominio",
  },
  {
    extension: ".css",
    pattern: /url\(\s*["']?(?:https?:)?\/\//gi,
    problem: "recurso de otro dominio",
  },
  { extension: ".css", pattern: /@import\s/gi, problem: "@import en CSS" },
  { extension: ".js", pattern: /\beval\(/g, problem: "eval (sin 'unsafe-eval')" },
];

const files = await listFiles(DIST);
const problems = [];
for (const file of files) {
  const rules = RULES.filter((rule) => rule.extension === extname(file));
  if (rules.length === 0) continue;
  const content = await readFile(file, "utf8");
  for (const rule of rules) {
    const matches = content.match(rule.pattern) ?? [];
    for (const match of matches) {
      problems.push(`${relative(process.cwd(), file)}: ${rule.problem}: ${match.trim()}`);
    }
  }
}

if (problems.length > 0) {
  console.error("El build no cumple la CSP de CloudFront:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `check-csp: ${files.length} archivos revisados, sin código en línea ni dominios externos.`,
);
