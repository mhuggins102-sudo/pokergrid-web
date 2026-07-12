import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // design-refs holds the Claude Design mockup artifacts (spec, not
  // shipped code) — don't lint them.
  { ignores: ['dist', 'coverage', 'node_modules', 'design-refs'] },
  {
    // Node build/tooling scripts (icon generation, screenshot sweep):
    // plain-Node globals, browser globals for the page.evaluate bodies.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The ported game core predates these conventions; keep the port
      // verbatim rather than fighting the linter.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Ported-verbatim game core + its tests: don't fight the original
    // code's conventions.
    files: ['src/game/**'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-const': 'off',
    },
  }
);
