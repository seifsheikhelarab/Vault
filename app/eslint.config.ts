import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import css from '@eslint/css';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        plugins: { js },
        extends: ['js/recommended'],
        languageOptions: { globals: globals.browser }
    },
    tseslint.configs.recommended,
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_' }
            ]
        }
    },
    // Disable no-explicit-any for test files — mock patterns genuinely need any
    {
        files: ['**/*.test.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off'
        }
    },
    {
        files: ['**/*.css'],
        plugins: { css },
        language: 'css/css',
        extends: ['css/recommended'],
        rules: {
            // Tailwind v4 @theme directive + custom properties
            'css/no-invalid-at-rules': 'off',
            'css/no-invalid-properties': 'off',
            // Legitimate !important use for dark-mode overrides, transition resets, and reduced-motion
            'css/no-important': 'off',
            // We intentionally use modern CSS: view-transition, animation-range, background-clip: text
            'css/use-baseline': 'off'
        }
    }
]);
