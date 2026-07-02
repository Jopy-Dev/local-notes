import eslint from "@eslint/js";
import tailwindcss from "eslint-plugin-tailwindcss";
import tseslint from "typescript-eslint";

/*
 * Anti-drift gate (workflow/repo-env.md 11c item 2): only Design_System.md
 * tokens style components - raw hex/rgb/hsl in className is a build error.
 * Token definitions live in src/frontend/styles/app.css (exempt: CSS, not
 * linted here).
 */
export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/", "coverage/", ".qa/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/frontend/**/*.tsx", "src/frontend/**/*.ts"],
    plugins: { tailwindcss },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\(/]",
          message:
            "Raw color in className - use Design_System.md tokens (app.css @theme) instead.",
        },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);
