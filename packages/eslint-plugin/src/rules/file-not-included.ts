import { createRule } from '../utils';
import { isBambooImport, isValidFile } from '../utils/helpers';
import { type TSESTree } from '@typescript-eslint/utils';

export const RULE_NAME = 'file-not-included';

const rule = createRule({
  create(context) {
    // Determine if the current file is included in the Bamboo CSS configuration
    const isFileIncluded = isValidFile(context);

    // If the file is included, no need to proceed
    if (isFileIncluded) {
      return {};
    }

    let hasReported = false;

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        if (hasReported) {
          return;
        }

        if (!isBambooImport(node, context)) {
          return;
        }

        // Report only on the first import declaration
        context.report({
          messageId: 'include',
          node,
        });

        hasReported = true;
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        'Disallow the use of Bamboo CSS in files that are not included in the specified Bamboo CSS `include` config.',
    },
    messages: {
      include:
        'The use of Bamboo CSS is not allowed in this file. Please ensure the file is included in the Bamboo CSS `include` configuration.',
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
});

export default rule;
