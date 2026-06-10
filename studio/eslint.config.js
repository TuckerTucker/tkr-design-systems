// Studio monorepo ESLint flat config — recommended rules plus the project
// standards (TypeScript strict workspaces, ES modules, named exports).
import js from "@eslint/js";
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
    // Config files conventionally use default exports (vitest, eslint).
    files: ["**/vitest.config.ts", "eslint.config.js"],
    rules: {
      "no-restricted-exports": "off",
    },
  },
);
