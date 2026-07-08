import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import simpleImportSort from "eslint-plugin-simple-import-sort";

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
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": ["error", { groups: importGroups }],
    },
  },
]);
