import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // React 19 compiler-adjacent rules downgraded from error → warn.
  // These land loudly in `next lint` but not every existing effect /
  // component pattern in this ~2-month codebase deserves to block CI
  // over them. They stay VISIBLE (warnings still print) so we
  // migrate them feature-by-feature; but they don't gate the merge.
  // When we clean the last one out, promote the whole block back to
  // "error" and delete this override.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);

export default eslintConfig;
