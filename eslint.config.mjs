import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...tseslint.configs.recommended,
  { plugins: { "@next/next": nextPlugin }, rules: nextPlugin.configs.recommended.rules },
);
