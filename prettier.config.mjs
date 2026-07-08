/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
export default {
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./apps/web/app/globals.css",
  tailwindFunctions: ["cn", "clsx", "cva"],
};
