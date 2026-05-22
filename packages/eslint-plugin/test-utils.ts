import { RuleTester } from '@typescript-eslint/rule-tester';

export const eslintTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: { jsx: true },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
});
