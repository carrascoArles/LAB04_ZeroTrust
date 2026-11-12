import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const TOKENS_IN_MEMORY = "CA-NF11.1: los tokens viven solo en memoria; no se usa localStorage.";
const INTEGER_MONEY = "Dinero en céntimos enteros: usa parseSolesToCents (src/domain/money.ts).";

export default tseslint.config(
  { ignores: ["dist/", "coverage/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat["recommended-latest"],
  reactRefresh.configs.vite,
  {
    languageOptions: { globals: globals.browser },
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: TOKENS_IN_MEMORY },
        { name: "parseFloat", message: INTEGER_MONEY },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: TOKENS_IN_MEMORY },
        { object: "globalThis", property: "localStorage", message: TOKENS_IN_MEMORY },
        { object: "Number", property: "parseFloat", message: INTEGER_MONEY },
      ],
    },
  },
  {
    files: ["scripts/**", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    // Las pruebas comprueban precisamente que localStorage quede vacío.
    files: ["test/**"],
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off" },
  },
);
