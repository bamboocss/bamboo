import type { ImportMap } from '@bamboocss/core'
import type { ResolveModule } from '@bamboocss/extractor'
import { ts, type SourceFile } from 'ts-morph'
import { getModuleSpecifierValue } from './get-module-specifier-value'

/**
 * Recipe bindings a file imports rather than declares.
 *
 * `const badge = cva(...)` in the file being parsed is registered by the parser's own
 * pre-pass, which is what made those calls visible. A recipe declared in `app/styles.ts`
 * and called anywhere else was not: the callee is an import, so `matchFn` declined it, the
 * extractor never recorded the call, and the fold saw nothing at all — neither a fold nor a
 * decline. A build could not distinguish "no recipe calls here" from "380 of them, none of
 * which anything looked at".
 *
 * Resolved through the *caller's* module resolver rather than `getModuleSpecifierSourceFile`
 * or a symbol's aliases. Both of those go through the symbol table, which forces
 * `initializeTypeChecker`; measured here it cost 4.5x on `parse only`, which is the same
 * trap `Project.resolveImport` documents avoiding. Everything below is a syntax walk over
 * statements the parser has already loaded.
 */

/** Where a recipe was declared: the module holding the `cva` call, and its name there. */
export interface RecipeOrigin {
  filePath: string
  name: string
}

export type { ResolveModule } from '@bamboocss/extractor'

/**
 * A module's exported recipes, memoized.
 *
 * Per *target*, so a barrel imported by two hundred files is walked once. Cleared alongside
 * the box-node cache, which is the same invalidation this needs: both memoize a conclusion
 * drawn from another file's contents.
 */
const exportedRecipes = new Map<SourceFile, Map<string, RecipeOrigin>>()

export const clearImportedRecipeCache = () => {
  exportedRecipes.clear()
}

/**
 * A walk's answer, and whether it is the whole answer.
 *
 * A cycle of `export *` truncates one side of itself, and caching that partial result would
 * make a binding's visibility depend on which module the walk started from — which is
 * whichever consumer the bundler transformed first.
 */
interface Walk {
  names: Map<string, RecipeOrigin>
  complete: boolean
}

/** The names a file bound `cva`/`sva` to, or empty when it imports neither. */
const recipeFactoryAliases = (sourceFile: SourceFile, imports: ImportMap): Set<string> => {
  const aliases = new Set<string>()

  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.isTypeOnly()) continue

    const mod = getModuleSpecifierValue(declaration)
    if (!mod) continue

    for (const specifier of declaration.getNamedImports()) {
      if (specifier.isTypeOnly()) continue

      const name = specifier.getNameNode().getText()
      if (name !== 'cva' && name !== 'sva') continue

      const alias = specifier.getAliasNode()?.getText() || name
      if (!imports.match({ name, alias, mod, kind: 'named' })) continue

      aliases.add(alias)
    }
  }

  return aliases
}

/** Recipes this module declares itself, by the name it declared them under. */
const declaredRecipes = (sourceFile: SourceFile, imports: ImportMap) => {
  const declared = new Map<string, RecipeOrigin>()
  const exported = new Set<string>()
  const factories = recipeFactoryAliases(sourceFile, imports)
  if (factories.size === 0) return { declared, exported }

  const filePath = sourceFile.getFilePath()

  for (const statement of sourceFile.compilerNode.statements) {
    if (!ts.isVariableStatement(statement)) continue
    // `const` only, for the reason the in-file pre-pass says: a `let` can be reassigned to
    // something that is not a recipe, and a name is registered for the whole file.
    if (!(statement.declarationList.flags & ts.NodeFlags.Const)) continue

    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer
      if (!initializer || !ts.isCallExpression(initializer)) continue

      const callee = initializer.expression
      if (!ts.isIdentifier(callee) || !ts.isIdentifier(declaration.name)) continue
      if (!factories.has(callee.text)) continue

      declared.set(declaration.name.text, { filePath, name: declaration.name.text })
      if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        exported.add(declaration.name.text)
      }
    }
  }

  return { declared, exported }
}

/**
 * Every name this module exports that is bound to a recipe, and where it was declared.
 *
 * Follows `export { x } from './m'`, `export * from './m'`, and `import { x } … export { x }`,
 * because a barrel is how these are reached in practice. The origin is carried through each
 * hop rather than recomputed, so a consumer learns the *declaring* module however many
 * re-exports stand between them.
 *
 * A star export contributes only names nothing else exports, which is what the language does:
 * an explicit export shadows one arriving through `export *`. Resolving that the other way
 * folded a call against a config it would never have run.
 */
const walkExports = (
  sourceFile: SourceFile,
  imports: ImportMap,
  resolveModule: ResolveModule,
  seen: Set<SourceFile>,
): Walk => {
  const cached = exportedRecipes.get(sourceFile)
  if (cached) return { names: cached, complete: true }

  // Already being walked further up this chain. Its own contribution arrives there.
  if (seen.has(sourceFile)) return { names: new Map(), complete: false }
  seen.add(sourceFile)

  const names = new Map<string, RecipeOrigin>()
  /** Reachable under a local name — declarations, plus recipes this module imports. */
  const local = new Map<string, RecipeOrigin>()
  /** Held back so an explicit export of the same name wins. */
  const starred = new Map<string, RecipeOrigin>()
  /** Names two different star exports both carry, which resolve to neither. */
  const ambiguous = new Set<string>()
  let complete = true

  const { declared, exported } = declaredRecipes(sourceFile, imports)
  for (const [name, origin] of declared) {
    local.set(name, origin)
    if (exported.has(name)) names.set(name, origin)
  }

  const imported = walkImports(sourceFile, imports, resolveModule, seen)
  complete &&= imported.complete
  for (const [alias, origin] of imported.bindings) {
    // A declaration of the same name is what the export would refer to.
    if (!local.has(alias)) local.set(alias, origin)
  }

  for (const declaration of sourceFile.getExportDeclarations()) {
    if (declaration.isTypeOnly()) continue

    const specifier = getModuleSpecifierValue(declaration)
    const target = specifier ? resolveModule(specifier, sourceFile) : undefined
    if (specifier && !target) continue

    // `export * as ns from './m'` reports itself a namespace export too, and it re-exports
    // no individual name — it binds one object called `ns`. Reading it as `export *` made
    // `import { textInput }` from such a barrel fold, though it resolves to nothing at all.
    if (declaration.getNamespaceExport()) continue

    if (declaration.isNamespaceExport()) {
      if (!target) continue
      const walk = walkExports(target, imports, resolveModule, seen)
      complete &&= walk.complete

      for (const [name, origin] of walk.names) {
        const existing = starred.get(name)
        // Two stars carrying the same name make it ambiguous, and importing it is a link
        // error rather than a choice between them. Neither is folded.
        if (existing && (existing.filePath !== origin.filePath || existing.name !== origin.name)) {
          ambiguous.add(name)
          continue
        }
        starred.set(name, origin)
      }
      continue
    }

    let source = local
    if (target) {
      const walk = walkExports(target, imports, resolveModule, seen)
      complete &&= walk.complete
      source = walk.names
    }

    for (const exportSpecifier of declaration.getNamedExports()) {
      if (exportSpecifier.isTypeOnly()) continue

      const name = exportSpecifier.getNameNode().getText()
      const origin = source.get(name)
      if (origin) names.set(exportSpecifier.getAliasNode()?.getText() || name, origin)
    }
  }

  for (const [name, origin] of starred) {
    if (!names.has(name) && !ambiguous.has(name)) names.set(name, origin)
  }

  // Only a complete answer is worth keeping: a truncated one is an artefact of where the
  // walk began, and caching it would fix that artefact in place for the rest of the build.
  if (complete) exportedRecipes.set(sourceFile, names)
  return { names, complete }
}

/**
 * Local names in this file bound, through an import, to a recipe declared elsewhere.
 *
 * Reports truncation for the same reason `walkExports` does: `export { x }` with no `from`
 * resolves through here, so a walk cut short by a cycle can leave a name out — and caching
 * that as the whole answer is what makes visibility depend on where the walk began.
 */
const walkImports = (
  sourceFile: SourceFile,
  imports: ImportMap,
  resolveModule: ResolveModule,
  seen: Set<SourceFile>,
): { bindings: Map<string, RecipeOrigin>; complete: boolean } => {
  const bindings = new Map<string, RecipeOrigin>()
  let complete = true

  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.isTypeOnly()) continue

    const named = declaration.getNamedImports()
    if (named.length === 0) continue

    const specifier = getModuleSpecifierValue(declaration)
    if (!specifier) continue

    const target = resolveModule(specifier, sourceFile)
    if (!target || target === sourceFile) continue

    const walk = walkExports(target, imports, resolveModule, seen)
    complete &&= walk.complete
    const { names } = walk
    if (names.size === 0) continue

    for (const importSpecifier of named) {
      if (importSpecifier.isTypeOnly()) continue

      const origin = names.get(importSpecifier.getNameNode().getText())
      if (!origin) continue

      bindings.set(importSpecifier.getAliasNode()?.getText() || importSpecifier.getNameNode().getText(), origin)
    }
  }

  return { bindings, complete }
}

/**
 * Local names in this file bound, through an import, to a recipe declared elsewhere.
 *
 * Only specifiers the caller's resolver can place inside the project. A recipe outside the
 * project's `include` is never parsed, so it has no rules in the stylesheet and could not be
 * folded against even if the binding resolved.
 */
export const importedRecipeBindings = (
  sourceFile: SourceFile,
  imports: ImportMap,
  resolveModule: ResolveModule,
): Map<string, RecipeOrigin> => walkImports(sourceFile, imports, resolveModule, new Set([sourceFile])).bindings
