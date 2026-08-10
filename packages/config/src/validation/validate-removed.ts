import type { UserConfig } from '@bamboocss/types'

/**
 * Config options that no longer exist, and what replaced them.
 *
 * An unknown key is otherwise *silently ignored* — nothing walks the config for keys it does not
 * recognise. So removing an option without this leaves the worst possible upgrade: the build
 * reverts to the default and says nothing, and an assertion the user asked for simply stops being
 * enforced. That is exactly the shape a renamed prune flag would have taken.
 *
 * Keyed by the removed name so the message can say what to write instead, rather than reporting a
 * bare "unknown option". Entries can be dropped a release or two after removal, once nobody is
 * upgrading across them.
 */
const REMOVED: Record<string, (value: unknown) => string> = {
  pruneUnusedTokens: (value) =>
    value === 'strict'
      ? `\`pruneUnusedTokens: 'strict'\` is now \`prune: { unresolved: 'error' }\`. "strict" meant something unrelated to \`strictTokens\`, so the option is named for what it checks.`
      : `\`pruneUnusedTokens\` is now \`prune: { tokens: ${value === false ? 'false' : 'true'} }\`.`,
  pruneUnusedKeyframes: (value) =>
    `\`pruneUnusedKeyframes\` is now \`prune: { keyframes: ${value === false ? 'false' : 'true'} }\`.`,
  prunePreflight: (value) =>
    `\`prunePreflight\` is now \`prune: { preflight: ${value === false ? 'false' : 'true'} }\`.`,
}

export function validateRemovedOptions(
  config: Partial<UserConfig>,
  addError: (scope: string, message: string) => void,
) {
  for (const [name, describe] of Object.entries(REMOVED)) {
    if (!Object.hasOwn(config, name)) continue
    addError('config', describe((config as Record<string, unknown>)[name]))
  }
}
