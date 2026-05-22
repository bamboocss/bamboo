import { rules } from '../rules';
import { RULE_NAME as FileNotIncluded } from '../rules/file-not-included';
import { RULE_NAME as NoConfigFunctionInSource } from '../rules/no-config-function-in-source';
import { RULE_NAME as NoInvalidTokenPaths } from '../rules/no-invalid-token-paths';

const errorRules = [
  FileNotIncluded,
  NoConfigFunctionInSource,
  NoInvalidTokenPaths,
];

const allRules = Object.fromEntries(
  Object.entries(rules).map(([name]) => {
    return [`bamboo/${name}`, errorRules.includes(name) ? 'error' : 'warn'];
  }),
);

export default {
  parser: '@typescript-eslint/parser',
  parserOptions: { sourceType: 'module' },
  plugins: ['bamboo'],
  rules: allRules,
};
