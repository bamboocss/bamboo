import { BambooError, walkObject } from '@bamboocss/shared'
import type { UserConfig } from '@bamboocss/types'
import { findCurlyReference, findFallbackReference, formatPath, isValidToken, serializeTokenValue } from './utils'

/**
 * Token values still written in a retired reference syntax.
 *
 * A hard error, and one that runs ahead of `validation` rather than under it. The rest of
 * `validateConfig` reports opinions about a config that will still build; this reports a spelling
 * that no longer means anything, whose output is broken either way — in a token value the text is
 * emitted into the stylesheet as-is, and nothing downstream reports it. `validation: 'none'` is an
 * opt-out of opinions, not of that.
 *
 * Safe to throw on because the spelling was never available for anything else: until it was
 * removed, `{…}` in a value was consumed unconditionally — braces stripped, unresolved paths
 * emitted bare — so no literal `{a.b}` could have survived to mean itself.
 *
 * Every occurrence is collected before throwing, because the point is to fix a config once rather
 * than to be told about it one token at a time. Delete this a release or two after removal, along
 * with `validate-removed.ts`.
 */
export function assertNoRetiredSyntax(config: Partial<UserConfig>): void {
  const found: string[] = []

  const collect = (source: object | undefined, label: string) => {
    if (!source) return

    walkObject(
      source,
      (token, path) => {
        if (!isValidToken(token)) return

        const value = serializeTokenValue((token as { value?: unknown }).value ?? token)
        const at = `${label}.${formatPath(path.join('.'))}`

        // The edit for *this* token, rather than an example of one.
        const curly = findCurlyReference(value)
        if (curly) found.push(`- \`${at}\`: \`${curly}\` → \`token(${curly.slice(1, -1)})\``)

        const fallback = findFallbackReference(value)
        if (fallback) {
          const path = fallback.slice('token('.length, fallback.lastIndexOf(',')).trim()
          found.push(`- \`${at}\`: \`${fallback}\` → \`token(${path})\``)
        }
      },
      { stop: isValidToken },
    )
  }

  collect(config.theme?.tokens, 'theme.tokens')
  collect(config.theme?.semanticTokens, 'theme.semanticTokens')

  // `themes` is a top-level option, not part of `theme`.
  for (const [name, variant] of Object.entries(config.themes ?? {})) {
    collect(variant?.tokens, `themes.${name}.tokens`)
    collect(variant?.semanticTokens, `themes.${name}.semanticTokens`)
  }

  if (!found.length) return

  throw new BambooError(
    'CONFIG_ERROR',
    `${found.length} token value(s) use a retired reference syntax:\n\n${found.join('\n')}\n\n` +
      `\`{colors.red.300}\` and \`token(colors.red.300, fallback)\` were both removed so a token is referenced one ` +
      `way. Neither is ignored quietly — the text is emitted into the stylesheet as-is.`,
  )
}
