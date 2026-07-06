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
    // Generated Prisma client:
    "src/generated/**",
    // Reference design-system export (source material, not app code):
    "RosterHouse Design System/**",
  ]),
  {
    // Design-token adherence (ported from the export's _adherence.oxlintrc.json):
    // no raw hex colors, no non-Figtree font families in app code.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message:
            "Raw hex color — use a design token via var(--...) instead.",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
          message:
            "Raw hex color — use a design token via var(--...) instead.",
        },
        {
          selector:
            "Property[key.name='fontFamily'] > Literal[value!=/var\\(--font-(sans|mono)\\)/]",
          message:
            "Font not provided by the design system. Use var(--font-sans) (Figtree) or var(--font-mono).",
        },
      ],
    },
  },
]);

export default eslintConfig;
