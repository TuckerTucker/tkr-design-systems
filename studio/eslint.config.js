// Studio monorepo ESLint flat config — recommended rules plus the project
// standards (TypeScript strict workspaces, ES modules, named exports).
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "workspaces/**",
      "_planning/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      "no-restricted-exports": [
        "error",
        { restrictDefaultExports: { direct: true } },
      ],
    },
  },
  {
    // Client (React SPA) — project standards extended to .tsx plus the
    // React hooks correctness rules.
    files: ["client/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      "no-restricted-exports": [
        "error",
        { restrictDefaultExports: { direct: true } },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    // Config files conventionally use default exports (vitest, eslint, vite).
    files: ["**/vitest.config.ts", "**/vite.config.ts", "eslint.config.js"],
    rules: {
      "no-restricted-exports": "off",
    },
  },
);
