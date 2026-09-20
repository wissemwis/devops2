import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'dist/**',
      '.cache/**',
      '.tmp/**',
      '.strapi/**',
      'public/**',
      'database/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Strapi generates content-type schemas/controllers with common
      // placeholder patterns (unused req/res params, etc.) — keep this
      // minimal and non-opinionated per constitution Principle II (YAGNI).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
