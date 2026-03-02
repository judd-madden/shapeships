import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
    // Only lint the fast-changing UI/client surface.
    {
        files: [
            "src/game/client/**/*.{ts,tsx,js,jsx}",
            "src/game/display/**/*.{ts,tsx,js,jsx}",
        ],
        languageOptions: {
            globals: globals.browser,
            parser: tseslint.parser,
            parserOptions: {
                ecmaFeatures: { jsx: true },
                sourceType: "module",
            },
        },
        settings: {
            react: { version: "detect" },
        },
    },

    // Sensible defaults (not stylistic).
    js.configs.recommended,
    ...tseslint.configs.recommended,
    pluginReact.configs.flat.recommended,

    // De-noise for an existing codebase; keep tripwires.
    {
        rules: {
            // React 17+ JSX transform
            "react/react-in-jsx-scope": "off",
            "react/no-unescaped-entities": "off",

            // Primary safety net
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],

            // Too noisy for now / legacy patterns
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-require-imports": "off",
            "no-case-declarations": "off",
            "prefer-const": "off",

            // Pragmatic for this project
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
        },
    },
]);