import { type ImportResult, syncAction } from '.'
import {
  isCallExpression,
  isIdentifier,
  isImportDeclaration,
  isImportSpecifier,
  isJSXAttribute,
  isJSXExpressionContainer,
  isJSXIdentifier,
  isJSXMemberExpression,
  isJSXOpeningElement,
  isLiteral,
  isMemberExpression,
  isTemplateLiteral,
  isVariableDeclarator,
  type Node,
} from './nodes'
import { type DeprecatedToken } from './worker'
import { analyze, type ScopeManager } from '@typescript-eslint/scope-manager'
import { type TSESTree } from '@typescript-eslint/utils'
import { type RuleContext } from '@typescript-eslint/utils/ts-eslint'

export const getAncestor = <N extends Node>(ofType: (node: Node) => node is N, for_: Node): N | undefined => {
  let current: Node | undefined = for_.parent
  while (current) {
    if (ofType(current)) {
      return current
    }

    current = current.parent
  }
}

const getSyncOptions = (context: RuleContext<any, any>) => {
  return {
    configPath: context.settings['@bamboocss/configPath'] as string | undefined,
    currentFile: context.filename,
  }
}

export const getImportSpecifiers = (context: RuleContext<any, any>) => {
  const specifiers: Array<{
    mod: string
    specifier: TSESTree.ImportSpecifier
  }> = []

  for (const node of context.sourceCode?.ast.body) {
    if (!isImportDeclaration(node)) {
      continue
    }

    const module_ = node.source.value
    if (!module_) {
      continue
    }

    for (const specifier of node.specifiers) {
      if (!isImportSpecifier(specifier)) {
        continue
      }

      specifiers.push({ mod: module_, specifier })
    }
  }

  return specifiers
}

export const hasPkgImport = (context: RuleContext<any, any>) => {
  const imports = _getImports(context)
  return imports.some(({ mod }) => mod === '@bamboocss/dev')
}

export const isBambooConfigFunction = (context: RuleContext<any, any>, name: string) => {
  const imports = _getImports(context)
  return imports.some(({ alias, mod }) => alias === name && mod === '@bamboocss/dev')
}

// Caching raw imports per context to avoid redundant AST traversal
const rawImportsCache = new WeakMap<RuleContext<any, any>, ImportResult[]>()

const _getImports = (context: RuleContext<any, any>) => {
  if (rawImportsCache.has(context)) {
    return rawImportsCache.get(context)!
  }

  const specifiers = getImportSpecifiers(context)

  const imports: ImportResult[] = specifiers.map(({ mod, specifier }) => ({
    alias: specifier.local.name,
    mod,
    name: (specifier.imported as any).name,
  }))

  rawImportsCache.set(context, imports)
  return imports
}

// Caching filtered imports per context to avoid redundant computations
const importsCache = new WeakMap<RuleContext<any, any>, ImportResult[]>()

const getImports = (context: RuleContext<any, any>): ImportResult[] => {
  if (importsCache.has(context)) {
    return importsCache.get(context)!
  }

  const imports = _getImports(context)
  // Batch filter all imports in a single sync call to reduce worker thread crossings
  const filteredImports = syncAction('filterImports', getSyncOptions(context), imports)
  // syncAction returns undefined when the worker fails (e.g. config loading error).
  // Fall back to an empty array to prevent downstream crashes.
  const result = filteredImports ?? []
  importsCache.set(context, result)
  return result
}

const isValidStyledProperty = <T extends Node>(node: T, context: RuleContext<any, any>) => {
  return isJSXIdentifier(node) && isValidProperty(node.name, context)
}

const matchFile = (name: string, imports: ImportResult[], context: RuleContext<any, any>) => {
  return syncAction('matchFile', getSyncOptions(context), name, imports)
}

const isBambooIsh = (name: string, context: RuleContext<any, any>) => {
  const imports = getImports(context)
  if (imports.length === 0) {
    return false
  }

  // Check if the name is the jsx factory
  const jsxFactory = syncAction('getJsxFactory', getSyncOptions(context))
  if (jsxFactory && name === jsxFactory) {
    // Check if the jsx factory is imported
    return imports.some((imp) => imp.name === name || imp.alias === name)
  }

  return matchFile(name, imports, context)
}

// Caching scope analysis per AST to avoid expensive re-computation
const scopeCache = new WeakMap<TSESTree.Program, ScopeManager>()

const findDeclaration = (name: string, context: RuleContext<any, any>) => {
  try {
    const source = context.sourceCode

    if (!source) {
      console.warn("⚠️ ESLint's sourceCode is not available. Ensure that the rule is invoked with valid code.")
      return undefined
    }

    let scope = scopeCache.get(source.ast)
    if (!scope) {
      scope = analyze(source.ast, {
        sourceType: 'module',
      })
      scopeCache.set(source.ast, scope)
    }

    const decl = scope.variables
      .find((v) => v.name === name)
      ?.defs.find((d) => isIdentifier(d.name) && d.name.name === name)?.node
    if (isVariableDeclarator(decl)) {
      return decl
    }
  } catch (error) {
    console.error('Error in findDeclaration:', error)
    return undefined
  }
}

const isLocalStyledFactory = (node: TSESTree.JSXOpeningElement, context: RuleContext<any, any>) => {
  if (!isJSXIdentifier(node.name)) {
    return
  }

  const decl = findDeclaration(node.name.name, context)

  if (!decl) {
    return
  }

  if (!isCallExpression(decl.init)) {
    return
  }

  if (!isIdentifier(decl.init.callee)) {
    return
  }

  // Check if the callee is 'styled' from bamboo imports
  const calleeName = decl.init.callee.name
  const rawImports = _getImports(context)
  const isStyledImport = rawImports.some((imp) => imp.alias === calleeName && imp.mod.includes('bamboo'))

  if (!isStyledImport && !isBambooIsh(calleeName, context)) {
    return
  }

  return true
}

export const isValidFile = (context: RuleContext<any, any>) => {
  return syncAction('isValidFile', getSyncOptions(context))
}

export const isValidProperty = (name: string, context: RuleContext<any, any>, calleName?: string) => {
  return syncAction('isValidProperty', getSyncOptions(context), name, calleName)
}

export const isBambooImport = (node: TSESTree.ImportDeclaration, context: RuleContext<any, any>) => {
  const imports = getImports(context)
  return imports.some((imp) => imp.mod === node.source.value)
}

export const isBambooProp = (node: TSESTree.JSXAttribute, context: RuleContext<any, any>) => {
  const jsxAncestor = getAncestor(isJSXOpeningElement, node)

  if (!jsxAncestor) {
    return
  }

  // <styled.div /> && <Box />
  if (!isJSXMemberExpression(jsxAncestor.name) && !isJSXIdentifier(jsxAncestor.name)) {
    return
  }

  let isBambooComponent = false
  let componentName: string | undefined

  if (isJSXMemberExpression(jsxAncestor.name)) {
    // For <styled.div>, check if 'styled' is a Bamboo import
    const objectName = (jsxAncestor.name.object as any).name
    componentName = objectName
    // Check if 'styled' is imported from bamboo - check both filtered and raw imports
    const imports = getImports(context)
    const rawImports = _getImports(context)
    isBambooComponent =
      imports.some((imp) => imp.alias === objectName) ||
      rawImports.some((imp) => imp.alias === objectName && imp.mod.includes('bamboo')) ||
      isBambooIsh(objectName, context)

    // For styled.div, all props are valid styled props
    if (isBambooComponent) {
      return true
    }
  } else if (isJSXIdentifier(jsxAncestor.name)) {
    // For <Circle> or <BambooComp>
    componentName = jsxAncestor.name.name

    // Check if it's a local styled factory (e.g., const BambooComp = styled(div))
    const isLocalStyled = isLocalStyledFactory(jsxAncestor, context)

    // For local styled components, we need to check if the prop is a valid Bamboo prop
    if (isLocalStyled) {
      const property = node.name.name
      // Special props like 'css' and props starting with '_' are Bamboo props
      if (property === 'css' || (typeof property === 'string' && property.startsWith('_'))) {
        return true
      }

      // Other props need to be valid style properties
      if (typeof property !== 'string' || !isValidProperty(property, context)) {
        return false
      }

      return true
    }

    // For imported Bamboo components like Circle
    isBambooComponent = isBambooIsh(componentName, context)
  }

  if (!isBambooComponent) {
    return
  }

  const property = node.name.name
  // Ensure prop is a styled prop
  if (typeof property !== 'string' || !isValidProperty(property, context, componentName)) {
    return
  }

  return true
}

export const isStyledProperty = (node: TSESTree.Property, context: RuleContext<any, any>, calleeName?: string) => {
  if (!isIdentifier(node.key) && !isLiteral(node.key) && !isTemplateLiteral(node.key)) {
    return
  }

  if (isIdentifier(node.key) && !isValidProperty(node.key.name, context, calleeName)) {
    return
  }

  if (
    isLiteral(node.key) &&
    typeof node.key.value === 'string' &&
    !isValidProperty(node.key.value, context, calleeName)
  ) {
    return
  }

  if (isTemplateLiteral(node.key) && !isValidProperty(node.key.quasis[0].value.raw, context, calleeName)) {
    return
  }

  return true
}

export const isInBambooFunction = (node: TSESTree.Property, context: RuleContext<any, any>) => {
  const callAncestor = getAncestor(isCallExpression, node)
  if (!callAncestor) {
    return
  }

  let calleeName: string | undefined

  // E.g. css({...}), cvs({...})
  if (isIdentifier(callAncestor.callee)) {
    calleeName = callAncestor.callee.name
  }

  // E.g. css.raw({...})
  if (isMemberExpression(callAncestor.callee) && isIdentifier(callAncestor.callee.object)) {
    calleeName = callAncestor.callee.object.name
  }

  if (!calleeName) {
    return
  }

  if (!isBambooIsh(calleeName, context)) {
    return
  }

  return calleeName
}

export const isInJSXProp = (node: TSESTree.Property, context: RuleContext<any, any>) => {
  const jsxExprAncestor = getAncestor(isJSXExpressionContainer, node)
  const jsxAttributeAncestor = getAncestor(isJSXAttribute, node)

  if (!jsxExprAncestor || !jsxAttributeAncestor) {
    return
  }

  // Get the JSX element to check if it's a Bamboo component
  const jsxElement = getAncestor(isJSXOpeningElement, jsxAttributeAncestor)
  if (!jsxElement) {
    return
  }

  // Check if it's a Bamboo component (styled.div, Circle, etc.)
  let isBambooComponent = false
  if (isJSXMemberExpression(jsxElement.name)) {
    // For <styled.div>, check if 'styled' is a Bamboo import
    const objectName = (jsxElement.name.object as any).name
    isBambooComponent = isBambooIsh(objectName, context)
  } else if (isJSXIdentifier(jsxElement.name)) {
    // For <Circle> or <BambooComp>
    const componentName = jsxElement.name.name
    isBambooComponent = isBambooIsh(componentName, context) || Boolean(isLocalStyledFactory(jsxElement, context))
  }

  if (!isBambooComponent) {
    return
  }

  // Check if the attribute name is a valid styled prop
  if (!isJSXIdentifier(jsxAttributeAncestor.name)) {
    return
  }

  if (!isValidStyledProperty(jsxAttributeAncestor.name, context)) {
    return
  }

  return true
}

export const isBambooAttribute = (node: TSESTree.Property, context: RuleContext<any, any>) => {
  const callAncestor = getAncestor(isCallExpression, node)

  if (callAncestor) {
    const callee = isInBambooFunction(node, context)
    if (!callee) {
      return
    }

    return isStyledProperty(node, context, callee)
  }

  // Object could be in JSX prop value i.e css prop or a pseudo
  return isInJSXProp(node, context) && isStyledProperty(node, context)
}

export const resolveLonghand = (name: string, context: RuleContext<any, any>) => {
  return syncAction('resolveLongHand', getSyncOptions(context), name)
}

export const resolveShorthands = (name: string, context: RuleContext<any, any>) => {
  return syncAction('resolveShorthands', getSyncOptions(context), name)
}

export const isColorAttribute = (attribute: string, context: RuleContext<any, any>) => {
  return syncAction('isColorAttribute', getSyncOptions(context), attribute)
}

export const isColorToken = (value: string | undefined, context: RuleContext<any, any>) => {
  if (!value) {
    return
  }

  return syncAction('isColorToken', getSyncOptions(context), value)
}

export const extractTokens = (value: string) => {
  const regex = /token\(([^"'(),]+)(?:,\s*([^"'(),]+))?\)|\{([^\n\r{}]+)\}/g
  const matches = []
  let match

  while ((match = regex.exec(value)) !== null) {
    const tokenFromFirstSyntax = match[1] || match[2] || match[3]
    const tokensFromSecondSyntax = match[4] && match[4].match(/(\w+\.\w+(\.\w+)?)/g)

    if (tokenFromFirstSyntax) {
      matches.push(tokenFromFirstSyntax)
    }

    if (tokensFromSecondSyntax) {
      matches.push(...tokensFromSecondSyntax)
    }
  }

  return matches.filter(Boolean)
}

// Caching invalid tokens to avoid redundant computations
const invalidTokensCache = new Map<string, string[]>()

export const getInvalidTokens = (value: string, context: RuleContext<any, any>) => {
  if (invalidTokensCache.has(value)) {
    return invalidTokensCache.get(value)!
  }

  const tokens = extractTokens(value)
  if (!tokens.length) {
    return []
  }

  const invalidTokens = syncAction('filterInvalidTokens', getSyncOptions(context), tokens)
  invalidTokensCache.set(value, invalidTokens)
  return invalidTokens
}

// Caching deprecated tokens to avoid redundant computations
const deprecatedTokensCache = new Map<string, DeprecatedToken[]>()

export const getDeprecatedTokens = (property: string, value: string, context: RuleContext<any, any>) => {
  const propertyCategory = syncAction('getPropCategory', getSyncOptions(context), property)

  const tokens = extractTokens(value)

  if (!propertyCategory && !tokens.length) {
    return []
  }

  const values = tokens.length ? tokens : [{ category: propertyCategory, value: value.split('/')[0] }]

  if (deprecatedTokensCache.has(value)) {
    return deprecatedTokensCache.get(value)!
  }

  const deprecatedTokens = syncAction('filterDeprecatedTokens', getSyncOptions(context), values)
  deprecatedTokensCache.set(value, deprecatedTokens)

  return deprecatedTokens
}

export const getTokenImport = (context: RuleContext<any, any>) => {
  const imports = _getImports(context)
  return imports.find((imp) => imp.name === 'token')
}

export const getTaggedTemplateCaller = (node: TSESTree.TaggedTemplateExpression) => {
  // css``
  if (isIdentifier(node.tag)) {
    return node.tag.name
  }

  // styled.h1``
  if (isMemberExpression(node.tag)) {
    if (!isIdentifier(node.tag.object)) {
      return
    }

    return node.tag.object.name
  }

  // styled(Comp)``
  if (isCallExpression(node.tag)) {
    if (!isIdentifier(node.tag.callee)) {
      return
    }

    return node.tag.callee.name
  }
}

export const isStyledTaggedTemplate = (node: TSESTree.TaggedTemplateExpression, context: RuleContext<any, any>) => {
  const caller = getTaggedTemplateCaller(node)
  if (!caller) {
    return false
  }

  // Check if 'styled' is imported from bamboo
  const rawImports = _getImports(context)
  const isStyledImport = rawImports.some((imp) => imp.alias === caller && imp.mod.includes('bamboo'))

  return isStyledImport || isBambooIsh(caller, context)
}

export function isRecipeVariant(node: TSESTree.Property, context: RuleContext<any, any>) {
  const caller = isInBambooFunction(node, context)
  if (!caller) {
    return
  }

  // Check if the caller is either 'cva' or 'sva'
  const recipe = getImports(context).find((imp) => ['cva', 'sva'].includes(imp.name) && imp.alias === caller)
  if (!recipe) {
    return
  }

  //* Nesting is different here because of slots and variants. We don't want to warn about those.
  let currentNode: any = node
  let length = 0
  let styleObjectParent: null | string = null

  // Traverse up the AST
  while (currentNode) {
    const keyName = currentNode?.key?.name
    if (keyName && ['base', 'variants'].includes(keyName)) {
      styleObjectParent = keyName
    }

    currentNode = currentNode.parent
    if (!styleObjectParent) {
      length++
    }
  }

  // Determine the required length based on caller and styleObjectParent
  const isCvaCaller = caller === 'cva'
  const requiredLength = isCvaCaller ? 2 : 4
  const extraLength = styleObjectParent === 'base' ? 0 : 4

  if (length < requiredLength + extraLength) {
    return true
  }
}
