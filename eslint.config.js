import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "draft/",
      "spike/",
      "media/",
      ".superpowers/",
      ".claude/",
      "node_modules/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
