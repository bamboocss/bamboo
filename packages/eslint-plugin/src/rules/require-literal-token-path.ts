import { type TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../utils'
import { isIdentifier, isLiteral, isTemplateLiteral } from '../utils/nodes'

export const RULE_NAME = 'require-literal-token-path'

/**
 * The wrappers a typed caller writes around a path, which carry no runtime meaning.
 *
 * The generated `Token` type is a union of template literals, so a `string`-typed substitution
 * does not typecheck without an assertion — `` token(`colors.${shade}` as Token) `` is the
 * idiomatic spelling, and reading only the outermost node would report it as dynamic when the
 * build bounds it perfectly well.
 */
const unwrap = (node: TSESTree.Node): TSESTree.Node => {
  switch (node.type) {
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
      return unwrap(node.expression)
    default:
      return node
  }
}

/**
 * How much of a token path the build can see.
 *
 * `literal` is a path spelled at the call. `bounded` is a template whose static head names a
 * category — the build cannot say which token it wants but knows which it cannot, so it keeps
 * that category and prunes the rest. `opaque` is everything else.
 *
 * Mirrors `literalPath` in `@bamboocss/node`, down to reading the *cooked* head and treating an
 * empty one as no bound at all. The rule's whole value is predicting what the build will do,
 * so a disagreement here is worse than no rule.
 */
const reach = (argument: TSESTree.Node | undefined): 'literal' | 'bounded' | 'opaque' => {
  if (!argument) return 'opaque'

  const node = unwrap(argument)

  if (isLiteral(node) && typeof node.value === 'string') return 'literal'

  if (isTemplateLiteral(node)) {
    if (node.expressions.length === 0) return 'literal'
    // The head is the whole bound: `` `colors.${a}.${b}` `` bounds no more tightly than
    // `` `colors.${x}` ``, and an empty head bounds nothing at all.
    return node.quasis[0]?.value.cooked ? 'bounded' : 'opaque'
  }

  return 'opaque'
}

/** A member name, whether written `a.b` or `a['b']`. */
const memberName = (node: TSESTree.MemberExpression) => {
  if (!node.computed) return isIdentifier(node.property) ? node.property.name : undefined
  return isLiteral(node.property) && typeof node.property.value === 'string' ? node.property.value : undefined
}

const rule = createRule({
  create(context) {
    /**
     * Names bound to the generated token artifact in this file.
     *
     * Collected here rather than through the shared `getTokenImport`, which searches *every*
     * module for a specifier named `token` and takes the first. That is wrong in both
     * directions: an unrelated `import { token as authToken } from './auth'` made this rule
     * report on a file with no Bamboo in it, and — worse — an unrelated `token` import
     * declared above the real one *masked* it, so whether a genuinely dynamic path was
     * reported depended on import order.
     *
     * The specifier test is a substring, like the build's cheap pass. It over-matches
     * `./tokenserver`, which is harmless: the build declines a `token` call through any
     * namespace it cannot classify, so over-matching agrees with it. It under-matches a
     * tsconfig path alias, which the build resolves and this cannot — that gap is documented
     * rather than papered over.
     */
    let bindings: { direct: Set<string>; namespaces: Set<string> } | undefined

    const bound = () => {
      if (bindings) return bindings

      bindings = { direct: new Set<string>(), namespaces: new Set<string>() }

      for (const node of context.sourceCode.ast.body) {
        if (node.type !== 'ImportDeclaration') continue
        if (!String(node.source.value).includes('tokens')) continue

        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') bindings.namespaces.add(specifier.local.name)
          if (specifier.type === 'ImportSpecifier' && isIdentifier(specifier.imported)) {
            if (specifier.imported.name === 'token') bindings.direct.add(specifier.local.name)
          }
        }
      }

      return bindings
    }

    /**
     * Whether this call reaches the generated `token`.
     *
     * A bare `token(…)` counts even with no import to bind it, because the build counts it: its
     * accounting keys on the name, so a local helper of that name declines there too. Staying
     * quiet about it would mean `strict` failing a build the editor called clean.
     */
    const isTokenCall = (node: TSESTree.CallExpression | TSESTree.TaggedTemplateExpression) => {
      const callee = node.type === 'CallExpression' ? node.callee : node.tag
      const { direct, namespaces } = bound()

      if (isIdentifier(callee)) return direct.has(callee.name) || callee.name === 'token'

      if (callee.type !== 'MemberExpression') return false

      // `token['value'](…)` reaches the same function, and the build declines it whatever the
      // path is — its accounting reads a property access and a computed one is not one. So the
      // path is never consulted: the call is opaque because of how it is *written*.
      if (callee.computed) return isComputedTokenCallee(callee, direct, namespaces) ? 'computed' : false

      const property = memberName(callee)
      if (property === undefined) return false

      // `token.value(…)`, and the same on a local binding the build would also decline.
      if (isIdentifier(callee.object) && (direct.has(callee.object.name) || callee.object.name === 'token')) {
        return property === 'value'
      }

      // `ns.token(…)`
      if (property === 'token') return isIdentifier(callee.object) && namespaces.has(callee.object.name)

      // `ns.token.value(…)`
      return (
        property === 'value' &&
        callee.object.type === 'MemberExpression' &&
        memberName(callee.object) === 'token' &&
        isIdentifier(callee.object.object) &&
        namespaces.has(callee.object.object.name)
      )
    }

    /** The same shapes as below, but reached through a computed member. */
    const isComputedTokenCallee = (callee: TSESTree.MemberExpression, direct: Set<string>, namespaces: Set<string>) => {
      const property = memberName(callee)
      if (property === undefined) return false

      if (isIdentifier(callee.object) && (direct.has(callee.object.name) || callee.object.name === 'token')) {
        return property === 'value'
      }

      if (property === 'token') return isIdentifier(callee.object) && namespaces.has(callee.object.name)

      return false
    }

    const report = (node: TSESTree.Node, found: 'bounded' | 'opaque', at: TSESTree.Node) => {
      context.report({ messageId: found === 'bounded' ? 'boundedTokenPath' : 'opaqueTokenPath', node: at })
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const kind = isTokenCall(node)
        if (!kind) return

        // A computed callee never resolves, whatever the path says.
        const found = kind === 'computed' ? 'opaque' : reach(node.arguments[0])
        if (found === 'literal') return

        report(node, found, node.arguments[0] ?? node)
      },

      /**
       * `` token`colors.${s}` `` — a different node, and one the build declines outright since
       * the artifact exports a function rather than a tag. Reported as opaque whatever its
       * head, because the call never resolves at all.
       */
      TaggedTemplateExpression(node: TSESTree.TaggedTemplateExpression) {
        if (!isTokenCall(node)) return

        report(node, 'opaque', node.quasi)
      },
    }
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        'Require a token path the build can resolve, so `prune.tokens` can drop the declarations nothing asks for.',
    },
    messages: {
      /**
       * The build keeps every token declaration for this, because the path could name any of
       * them. Under `prune: { unresolved: 'error' }` it is an error rather than a size cost.
       */
      opaqueTokenPath:
        'Token path cannot be resolved at build time, so every token declaration is kept. Spell the path at the call, or give a template a static prefix.',
      /**
       * Not wrong — the build keeps the category and prunes the rest — but a spelled-out path
       * keeps one declaration where this keeps hundreds, so it is worth knowing about.
       */
      boundedTokenPath:
        'Token path is bounded by its prefix rather than resolved, so the whole category is kept. Spell the path at the call to keep only what you use.',
    },
    schema: [],
    type: 'problem',
  },
  name: RULE_NAME,
})

export default rule
