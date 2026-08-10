import type { Context } from '@bamboocss/core'
import outdent from 'outdent'

/**
 * `token()` hands back the variable reference for every token, and `token.value()` the
 * resolved literal.
 *
 * It used to be the other way round, decided per token: a base token resolved to its literal
 * and a virtual or conditional one to its `var()`. That made the return kind a property of
 * the *theme* rather than of the call, so adding `_dark` to a token silently changed what
 * every caller received — same call, same path, a colour before and a variable after, with
 * both typed `string` and nothing to catch it.
 *
 * Always-a-reference is the predictable half and the one that keeps working when a theme
 * switches, so it takes the short name. The literal is still reachable, but has to be asked
 * for — which is also the honest signal, since it is the form that stops responding to
 * conditions.
 *
 * `value` keeps the old per-token split rather than becoming `token.value` for everything:
 * a virtual or conditional token has no single literal to hand back, so its `var()` is still
 * the only truthful answer.
 */
export function generateTokenJs(ctx: Context) {
  const { tokens } = ctx
  const map = new Map<string, { value: string; variable: string }>()

  tokens.allTokens.forEach((token) => {
    const { varRef, isVirtual } = token.extensions

    // Both halves come off the view rather than being re-derived here, so this cannot drift
    // from what the extractor resolves an in-style-object call to. It did drift: `varRef` is
    // the obvious-looking source for the reference half and is wrong for a negative token,
    // which has no variable of its own — `addCssVariables` formats its var from
    // `originalPath`, so `spacing.-4`'s `varRef` is `var(--spacing-4)` and the negation lives
    // only in the value. Reading it there turned `token('spacing.-4')` into a *positive*
    // length. `generate-token-js.test.ts` pins the agreement per token now.
    //
    // The fallbacks stand in for a token the view has no entry for, which is one without a
    // category.
    const variable = tokens.view.getVar(token.name) ?? varRef
    const value =
      tokens.view.get(token.name) ?? (isVirtual || token.extensions.condition !== 'base' ? varRef : token.value)

    map.set(token.name, { value, variable })
  })

  const obj = Object.fromEntries(map)

  return {
    js: outdent`
  const tokens = ${JSON.stringify(obj, null, 2)}

  export function token(path, fallback) {
    return tokens[path]?.variable || fallback
  }

  function tokenValue(path, fallback) {
    return tokens[path]?.value || fallback
  }

  // \`token.var\` predates \`token()\` returning the reference itself. Kept as the same
  // function rather than removed, so the spelling that was correct before still is.
  token.var = token
  token.value = tokenValue
  `,
    dts: outdent`
  ${ctx.file.importType('Token', './tokens')}

  export declare const token: {
    /** The css variable reference — \`var(--colors-red-300)\`. Stays correct across themes. */
    (path: Token, fallback?: string): string
    /** Alias of \`token()\`, kept for compatibility. */
    var: (path: Token, fallback?: string) => string
    /**
     * The resolved literal — \`#fca5a5\`. Use where css variables cannot be resolved, such as
     * canvas or a charting library. A conditional token has no single literal and still
     * returns its \`var()\`.
     */
    value: (path: Token, fallback?: string) => string
  }

  ${ctx.file.exportTypeStar('./tokens')}
  `,
  }
}
