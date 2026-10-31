import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const importGroups = [
  ["^react(?:$|/|\\u0000)"],
  ["^\\u0000"],
  ["^node:"],
  ["^@?\\w"],
  ["^"],
  ["^\\."],
  ["\\.(?:css|scss|sass|less|pcss)$"],
];

export default defineConfig([
  globalIgnores([".next/**", "next-env.d.ts"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  // Includes the React Compiler rules, which matter because reactCompiler is on.
  reactHooks.configs.flat.recommended,
  nextPlugin.configs["core-web-vitals"],
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": ["error", { groups: importGroups }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);
