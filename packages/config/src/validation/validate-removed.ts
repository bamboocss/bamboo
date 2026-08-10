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
      ? `\`pruneUnusedTokens: 'strict'\` is now \`prune: { tokens: 'accounted', unresolvedPath: 'error' }\`.`
      : `\`pruneUnusedTokens\` is now \`prune: { tokens: '${value === false ? 'off' : 'reachable'}' }\`.`,
  pruneUnusedKeyframes: (value) =>
    `\`pruneUnusedKeyframes\` is now \`prune: { keyframes: ${value === false ? 'false' : 'true'} }\`.`,
  prunePreflight: (value) =>
    `\`prunePreflight\` is now \`prune: { preflight: ${value === false ? 'false' : 'true'} }\`.`,

  globalCss: () => `\`globalCss\` is now \`global: { css }\`.`,
  globalFontface: () => `\`globalFontface\` is now \`global: { fontface }\`.`,
  globalPositionTry: () => `\`globalPositionTry\` is now \`global: { positionTry }\`.`,
  globalVars: () => `\`globalVars\` is now \`global: { vars }\`.`,

  themes: () =>
    `\`themes\` is now \`theme.variants\`. One character from \`theme\`, both spellings valid, so the typo resolved to a different feature instead of an error.`,

  eject: (value) =>
    value
      ? `\`eject: true\` is now \`presets: []\`. \`presets\` is the complete list — an unset \`presets\` loads \`defaultPresets\`, and listing your own no longer keeps a default underneath it.`
      : `\`eject: false\` is the default and can be removed. \`presets\` is now the complete list.`,

  lightningcss: (value) =>
    value
      ? `\`lightningcss: true\` is now \`plugins: [pluginLightningcss()]\` from \`@bamboocss/plugin-lightningcss\`, which you install yourself. The flag forced a static import, so every project carried the native binary whether or not it was on.`
      : `\`lightningcss: false\` is the default and can be removed.`,
}

/** Values that no longer exist for an option that does. Keyed by option, then by old value. */
const RETIRED_VALUES: Record<string, Record<string, string>> = {
  validation: {
    none: `\`validation: 'none'\` is now \`validation: 'off'\`, matching \`prune.unresolvedPath\`.`,
  },
}

/** Removed keys nested one level down, keyed by their parent. */
const REMOVED_NESTED: Record<string, Record<string, (value: unknown) => string>> = {
  prune: {
    unresolved: (value) =>
      `\`prune.unresolved\` is now \`prune.unresolvedPath\`, and the accounting pass it used to switch on is now \`prune.tokens: 'accounted'\` — write \`prune: { tokens: 'accounted', unresolvedPath: '${value === 'error' ? 'error' : 'warn'}' }\`. They are separate because \`'off'\` used to mean two things at once: no accounting, and no report.`,
  },
}

export function validateRemovedOptions(
  config: Partial<UserConfig>,
  addError: (scope: string, message: string) => void,
) {
  const dict = config as Record<string, any>

  for (const [name, describe] of Object.entries(REMOVED)) {
    if (!Object.hasOwn(config, name)) continue
    addError('config', describe(dict[name]))
  }

  for (const [parent, removed] of Object.entries(REMOVED_NESTED)) {
    const value = dict[parent]
    if (value == null || typeof value !== 'object') continue

    for (const [name, describe] of Object.entries(removed)) {
      if (!Object.hasOwn(value, name)) continue
      addError('config', describe(value[name]))
    }
  }

  for (const [name, retired] of Object.entries(RETIRED_VALUES)) {
    const value = dict[name]
    if (typeof value !== 'string') continue

    const message = retired[value]
    if (message) addError('config', message)
  }

  // `prune.tokens` went from a boolean to a strategy. A boolean is not an unknown key, so
  // nothing else reports it — it would just fail to match any branch and take the default.
  if (typeof dict.prune?.tokens === 'boolean') {
    addError(
      'config',
      `\`prune.tokens\` takes a strategy now, not a boolean — write \`'${dict.prune.tokens ? 'reachable' : 'off'}'\`. \`'accounted'\` is the new one: keeps computed from the token paths in your source rather than from what the css reaches.`,
    )
  }

  // Per-pattern, so it is missed by every check above.
  for (const [name, pattern] of Object.entries(config.patterns ?? {})) {
    const dictPattern = pattern as Record<string, unknown> | undefined
    if (!dictPattern) continue

    if (Object.hasOwn(dictPattern, 'strict')) {
      addError('patterns', `\`${name}.strict\` is now \`${name}.cssProps: '${dictPattern.strict ? 'none' : 'all'}'\`.`)
    }

    if (Object.hasOwn(dictPattern, 'blocklist')) {
      addError(
        'patterns',
        `\`${name}.blocklist\` is now \`${name}.cssProps: { except: [...] }\`, which is no longer experimental and no longer silently dropped when the pattern also set \`strict\`.`,
      )
    }
  }
}
