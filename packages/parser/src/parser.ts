import type { ImportResult, ParserOptions } from '@bamboocss/core'
import { BoxNodeMap, box, extract, unbox, type EvaluateOptions, type Unboxed } from '@bamboocss/extractor'
import type { Generator } from '@bamboocss/generator'
import { logger } from '@bamboocss/logger'
import type { ParserResultConfigureOptions } from '@bamboocss/types'
import type { SourceFile } from 'ts-morph'
import { Node, ts } from 'ts-morph'
import { match } from 'ts-pattern'
import { getImportDeclarations } from './get-import-declarations'
import { ParserResult } from './parser-result'

const combineResult = (unboxed: Unboxed) => {
  return [...unboxed.conditions, unboxed.raw, ...unboxed.spreadConditions]
}

const defaultEnv: EvaluateOptions['environment'] = {
  preset: 'ECMA',
}

/**
 * `fallback()` is generated into `styled-system/css`, so evaluating a call to it would mean
 * resolving and running generated code. It is a pure string builder, so the definition is
 * repeated here — without it the call is unresolvable and the whole declaration is dropped
 * with no diagnostic, which is worse than not shipping the helper at all.
 */
const fallbackImpl = (...values: unknown[]) =>
  // A candidate the evaluator could not resolve arrives as `undefined`, and joining it in
  // would build a class name the runtime helper never produces — a rule that matches
  // nothing. Returning `undefined` drops the declaration instead, which is what every other
  // unresolvable value does.
  values.some((value) => value === undefined) ? undefined : `fallback(${values.join(', ')})`

const evaluateOptions: EvaluateOptions = {
  environment: defaultEnv,
}

export function createParser(context: ParserOptions) {
  const { jsx, imports, recipes } = context

  return function parse(
    sourceFile: SourceFile | undefined,
    encoder?: Generator['encoder'],
    options?: ParserResultConfigureOptions,
  ) {
    if (!sourceFile) return

    const importDeclarations: ImportResult[] = getImportDeclarations(context, sourceFile)

    const file = imports.file(importDeclarations)

    const filePath = sourceFile.getFilePath()

    logger.debug(
      'ast:import',
      !file.isEmpty() ? `Found import { ${file.toString()} } in ${filePath}` : `No import found in ${filePath}`,
    )

    const parserResult = new ParserResult(context, encoder)

    if (file.isEmpty() && !jsx.isEnabled) {
      return parserResult
    }

    // Inline recipes bound to a local name, before `extract` asks about any of them.
    //
    // `cva({ ... })` is recognised by its import, but the function it returns is called under
    // whatever the file called it — `const badge = cva(...)`, then `badge({ tone })`. That
    // call was invisible: not folded, and not reported either, so a build could not tell an
    // unfoldable recipe invocation from one nothing had looked at. `file.matchFn` is memoized
    // per name, so registering these after extraction would be too late.
    //
    // Module scope only, and that is load-bearing rather than a simplification. A name here
    // is registered for the whole file, and the extractor buckets every call of a name under
    // one key — so a *nested* `const css = cva(...)` shadowing an import would make the
    // module's real `css()` calls look like recipe calls, and they would emit no rules at all.
    // A module-scope `const css` cannot collide, because redeclaring an import is an error.
    // The cost is a recipe declared inside a function, which rebuilds itself on every call and
    // whose rules come from the `cva(...)` definition regardless.
    //
    // Being a statement walk rather than a tree walk is also why this is free: gated on the
    // import, it touches one node per top-level statement. The recursive version measured ~10%
    // of extraction.
    if (file.importsRecipeFactory()) {
      for (const statement of sourceFile.compilerNode.statements) {
        // `const` only. A `let` can be reassigned to something that is not a recipe at all,
        // and a name is registered for the file rather than for a binding.
        if (!ts.isVariableStatement(statement)) continue
        if (!(statement.declarationList.flags & ts.NodeFlags.Const)) continue

        for (const declaration of statement.declarationList.declarations) {
          const initializer = declaration.initializer
          if (!initializer || !ts.isCallExpression(initializer)) continue

          const callee = initializer.expression
          if (!ts.isIdentifier(callee) || !ts.isIdentifier(declaration.name)) continue

          // The *imported* name, so a project's own `cva` helper is not mistaken for this one
          // — and `matchFn`, so a name that merely reads as `cva` is not either.
          const imported = file.getName(callee.text)
          if (imported !== 'cva' && imported !== 'sva') continue
          if (!file.matchFn(callee.text)) continue

          file.addLocalRecipe(declaration.name.text)
        }
      }
    }

    const extractResultByName = extract({
      ast: sourceFile,
      tokens: context.tokens
        ? {
            view: context.tokens.view,
            isTokenFn: (fnName) => file.isTokenAlias(fnName),
          }
        : undefined,
      components: jsx.isEnabled
        ? {
            matchTag: (prop) => {
              if (options?.matchTag) {
                // If the user has a custom matchTag function,
                // we're not going to match every uppercased tag
                const isBambooComponent = file.isBambooComponent(prop.tagName)
                const matchTagMode = options.matchTagMode ?? 'extend'
                const isCustomMatch = options.matchTag(prop.tagName, isBambooComponent)

                if (matchTagMode === 'override') {
                  return isCustomMatch
                }

                return isBambooComponent || isCustomMatch
              }

              return !!file.matchTag(prop.tagName)
            },
            matchProp: (prop) => {
              const isBambooProp = file.matchTagProp(prop.tagName, prop.propName)

              if (options?.matchTagProp) {
                return isBambooProp && options.matchTagProp(prop.tagName, prop.propName)
              }

              return isBambooProp
            },
          }
        : undefined,
      functions: {
        matchFn: (prop) => file.matchFn(prop.fnName),
        matchProp: () => true,
        matchArg: () => true,
      },
      getEvaluateOptions: (node) => {
        /**
         * `css(recipe.raw(props), …)` loses what the recipe would have contributed.
         *
         * `.raw` on a recipe or pattern takes props and returns styles; the build reads it as
         * the identity `css.raw` means. Resolving it properly would mean running the recipe
         * here, and emitting the wrong styles is worse than emitting none — so this says so
         * rather than guessing.
         */
        const reportUnresolvedRaw = (base: string, at: Node) => {
          const { line, column } = sourceFile.getLineAndColumnAtPos(at.getStart())
          parserResult.unresolved.push({ kind: 'atomic', prop: base, filePath, line, column, reason: 'unresolved-raw' })
        }

        if (!Node.isCallExpression(node)) return evaluateOptions
        const propAccessExpr = node.getExpression()

        // `fallback(...)`, under whatever name it was imported as.
        if (Node.isIdentifier(propAccessExpr)) {
          const local = propAccessExpr.getText()
          // `getName` echoes the identifier back when it is not an import, so the match has
          // to be confirmed against the import list — otherwise a project's own local
          // `fallback` helper would be shadowed by this one.
          if (!file.match(local) || file.getName(local) !== 'fallback') return evaluateOptions

          return {
            environment: Object.assign({}, defaultEnv, { extra: { [local]: fallbackImpl } }),
          }
        }

        if (!Node.isPropertyAccessExpression(propAccessExpr)) return evaluateOptions
        let name = propAccessExpr.getText()

        const rawBase = name.endsWith('.raw') ? name.slice(0, -'.raw'.length) : undefined

        // An inline recipe's `.raw` is not an `isRawFn`, so the call is simply unresolvable and
        // the composition silently contributes nothing. Reported here, before that early
        // return — and deliberately *not* given the identity below, which would hand the
        // recipe's variant names to the encoder as though they were properties.
        if (rawBase && file.isLocalRecipe(rawBase)) {
          reportUnresolvedRaw(rawBase, node)
          return evaluateOptions
        }

        if (!file.isRawFn(name as string)) {
          return evaluateOptions
        }

        name = name.replace('.raw', '')

        // The identity below is what `css.raw` means: it returns the style object it was
        // given. A recipe or pattern's `.raw` takes *props* and returns *styles*, so identity
        // composes the props — losing every declaration the recipe or pattern would have
        // contributed, and feeding variant names to the encoder as if they were properties.
        //
        // Reported rather than guessed at: resolving it properly means running the recipe here,
        // and emitting the wrong styles would be worse than emitting none. Without this the
        // element simply renders without them, with nothing said.
        if (file.isValidRecipe(name) || file.isValidPattern(name)) {
          reportUnresolvedRaw(name, node)
        }

        return {
          environment: Object.assign({}, defaultEnv, {
            extra: {
              [name]: { raw: (v: any) => v },
            },
          }),
        }
      },
      flags: { skipTraverseFiles: false },
    })

    extractResultByName.forEach((result, alias) => {
      //
      const name = file.getName(file.normalizeFnName(alias))

      logger.debug(`ast:${name}`, name !== alias ? { kind: result.kind, alias } : { kind: result.kind })

      if (result.kind === 'function') {
        // badge({ tone: 'red' }) -- a call of a recipe the file bound itself.
        //
        // Decided here rather than as a branch of the chain below, on `alias` rather than
        // `name`. `name` is the *resolved import* name, so a file that binds `const cva =
        // make(...)` resolves its own definition call to `cva` too, and a branch keyed on
        // that claimed the definition and emitted no rules for it. The identifier at the call
        // site is the only thing that distinguishes the two.
        //
        // Ahead of the chain because the first two branches match on a bare name —
        // `/^(css|cva|sva)$/` and `/^(token)$/`, built in `import-map.ts` and never consulting
        // the imports. A recipe a file called `sva` was read as a slot recipe, warning
        // `missing-property` against a recipe that does not exist; one called `token` became a
        // `dynamic` skip, enough to fail a `strict` build.
        // `!file.match(alias)` is a second line: an imported name is never a local recipe,
        // and swallowing one here would cost it its rules rather than merely misreport it.
        if (file.isLocalRecipe(alias) && !file.match(alias)) {
          result.queryList.forEach((query) => {
            if (query.kind === 'call-expression') {
              parserResult.setCvaCall(alias, {
                name: alias,
                box: (query.box.value[0] as BoxNodeMap) ?? box.fallback(query.box),
                data: combineResult(unbox(query.box.value[0])),
              })
            }
          })

          return
        }

        match(name)
          .when(imports.matchers.css.match, (name: 'css' | 'cva' | 'sva') => {
            // css({ ... }), cva({ ... }), sva({ ... })
            result.queryList.forEach((query) => {
              if (query.kind === 'call-expression') {
                // css({ ... }, { ... })
                if (query.box.value.length > 1) {
                  parserResult.set(name, {
                    name,
                    box: query.box,
                    data: query.box.value.reduce(
                      (acc, value) => [...acc, ...combineResult(unbox(value))],
                      [] as Array<Unboxed['raw']>,
                    ),
                  })
                } else {
                  // css({ ... })
                  parserResult.set(name, {
                    name,
                    box: (query.box.value[0] as BoxNodeMap) ?? box.fallback(query.box),
                    data: combineResult(unbox(query.box.value[0])),
                  })
                }
              }
            })
          })
          // token('...', '...')
          .when(imports.matchers.tokens.match, (name: 'token') => {
            result.queryList.forEach((query) => {
              if (query.kind === 'call-expression') {
                parserResult.setToken({
                  name,
                  box: (query.box.value[0] as BoxNodeMap) ?? box.fallback(query.box),
                  data: combineResult(unbox(query.box.value[0])),
                })
              }
            })
          })
          // stack({ ... })
          .when(file.isValidPattern, (name) => {
            result.queryList.forEach((query) => {
              if (query.kind === 'call-expression') {
                parserResult.setPattern(name, {
                  name,
                  box: (query.box.value[0] as BoxNodeMap) ?? box.fallback(query.box),
                  data: combineResult(unbox(query.box.value[0])),
                })
              }
            })
          })
          // button({ ... })
          .when(file.isValidRecipe, (name) => {
            result.queryList.forEach((query) => {
              if (query.kind === 'call-expression') {
                parserResult.setRecipe(name, {
                  name,
                  box: (query.box.value[0] as BoxNodeMap) ?? box.fallback(query.box),
                  data: combineResult(unbox(query.box.value[0])),
                })
              }
            })
          })
          // viewTransition({ group: { ... }, old: { ... } })
          //
          // Below the recipe and pattern branches, not above them: a project that has both
          // this import and a recipe of the same name is ambiguous, and the recipe is the
          // one whose styles would otherwise be silently dropped.
          .when(file.isViewTransitionFn, (name: string) => {
            result.queryList.forEach((query) => {
              if (query.kind === 'call-expression') {
                parserResult.setViewTransition({
                  name,
                  box: (query.box.value[0] as BoxNodeMap) ?? box.fallback(query.box),
                  data: combineResult(unbox(query.box.value[0])),
                })
              }
            })
          })
          .otherwise(() => {
            //
          })
        //
      } else if (jsx.isEnabled && result.kind === 'component') {
        // A recipe component the project wrote itself. Its variant props are only visible
        // here — the recipe call inside it takes `props`, which resolves to nothing.
        result.queryList.forEach((query) => {
          const data = combineResult(unbox(query.box))

          for (const tag of [name, alias]) {
            if (!jsx.isJsxTagRecipe(tag)) continue

            recipes.filter(tag).forEach((recipe) => {
              parserResult.setRecipe(recipe.baseName, { type: 'jsx-recipe', name: tag, box: query.box, data })
            })
            break
          }
        })
      }
    })

    return parserResult
  }
}
