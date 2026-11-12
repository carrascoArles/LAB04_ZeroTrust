import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Dinero en enteros: parseFloat no tiene cabida en este backend (AD-04).
      "no-restricted-globals": ["error", "parseFloat"],
    },
  },
);
