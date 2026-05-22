export default {
  parser: '@typescript-eslint/parser',
  parserOptions: { sourceType: 'module' },
  plugins: ['bamboo'],
  rules: {
    'bamboo/file-not-included': 'error',
    'bamboo/no-config-function-in-source': 'error',
    'bamboo/no-debug': 'warn',
    'bamboo/no-deprecated-tokens': 'warn',
    'bamboo/no-dynamic-styling': 'warn',
    'bamboo/no-hardcoded-color': 'warn',
    'bamboo/no-invalid-nesting': 'error',
    'bamboo/no-invalid-token-paths': 'error',
    'bamboo/no-property-renaming': 'warn',
    'bamboo/no-unsafe-token-fn-usage': 'warn',
  },
}
