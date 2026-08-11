import { logger } from '@bamboocss/logger'
import { BambooError } from '@bamboocss/shared'
import type { UserConfig } from '@bamboocss/types'
import type { ArtifactNames, TokensData } from './types'
import { validateArtifactNames } from './validation/validate-artifact'
import { validateBreakpoints } from './validation/validate-breakpoints'
import { validateConditions } from './validation/validate-condition'
import { validatePatterns } from './validation/validate-patterns'
import { validateRecipes } from './validation/validate-recipes'
import { assertNoRemovedOptions } from './validation/validate-removed'
import { assertNoRetiredSyntax } from './validation/validate-retired-syntax'
import { validateTokens } from './validation/validate-tokens'

/**
 * Validate the config
 * - Check for duplicate between token & semanticTokens names
 * - Check for duplicate between recipes/patterns/slots names
 * - Check for token / semanticTokens paths (must end/contain 'value')
 * - Check for self/circular token references
 * - Check for missing tokens references
 * - Check for conditions selectors (must contain '&')
 * - Check for breakpoints units (must be the same)
 * - Throw on options that have been removed, which are otherwise ignored in silence
 * - Throw on token values still written in the retired curly reference syntax
 *
 * The two throwing checks run first and answer to nothing below them. `validation` grades
 * *opinions about a config that still builds*; those two are evidence that the config is not
 * the one being read, which is a different question and not one a severity setting should
 * decide.
 */
export const validateConfig = (config: Partial<UserConfig>) => {
  // Ahead of the opt-out: a retired spelling is not an opinion about a config that still builds,
  // it is output that is already broken. See `validate-retired-syntax`.
  assertNoRetiredSyntax(config)

  // Also ahead of it. A removed key is unambiguous proof the config predates the version reading
  // it, and left alone it reverts to the default in silence — see `validate-removed`.
  assertNoRemovedOptions(config)

  const warnings = new Set<string>()

  const addError = (scope: string, message: string) => {
    warnings.add(`[${scope}] ` + message)
  }

  const report = () => {
    if (!warnings.size) return

    const errors = `⚠️ Invalid config:\n${Array.from(warnings)
      .map((err) => '- ' + err)
      .join('\n')}\n`

    if (config.validation === 'error') {
      throw new BambooError('CONFIG_ERROR', errors)
    }

    logger.warn('config', errors)

    return warnings
  }

  if (config.validation === 'off') return report()

  validateBreakpoints(config.theme?.breakpoints, addError)

  validateConditions(config.conditions, addError)

  const artifacts: ArtifactNames = {
    recipes: new Set(),
    slotRecipes: new Set(),
    patterns: new Set(),
  }

  const tokens: TokensData = {
    tokenNames: new Set(),
    semanticTokenNames: new Set(),
    valueAtPath: new Map(),
    refsByPath: new Map(),
    typeByPath: new Map(),
  }

  if (config.theme) {
    validateTokens({ config, tokens, addError })
    validateRecipes({ config, tokens, artifacts, addError })
  }

  validatePatterns(config.patterns, artifacts)

  validateArtifactNames(artifacts, addError)

  return report()
}
