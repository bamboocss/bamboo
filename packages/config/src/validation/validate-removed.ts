import { BambooError } from '@bamboocss/shared'
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
      ? `\`pruneUnusedTokens: 'strict'\` is now \`prune: { tokens: true, unresolvedPath: 'error' }\`.`
      : `\`pruneUnusedTokens\` is now \`prune: { tokens: ${value === false ? 'false' : 'true'} }\`.`,
  pruneUnusedKeyframes: (value) =>
    `\`pruneUnusedKeyframes\` is now \`prune: { keyframes: ${value === false ? 'false' : 'true'} }\`.`,
  prunePreflight: (value) =>
    `\`prunePreflight\` is now \`preflight: { prune: ${value === false ? 'false' : 'true'} }\`.`,

  globalCss: () => `\`globalCss\` is now \`global: { css }\`.`,
  globalFontface: () => `\`globalFontface\` is now \`global: { fontface }\`.`,
  globalPositionTry: () => `\`globalPositionTry\` is now \`global: { positionTry }\`.`,
  globalVars: () => `\`globalVars\` is now \`global: { vars }\`.`,

  themes: () =>
    `\`themes\` is now \`theme.variants\`. One character from \`theme\`, both spellings valid, so the typo resolved to a different feature instead of an error.`,

  eject: (value) =>
    value
      ? `\`eject: true\` is now \`presets: []\`. \`presets\` is the complete list — an unset \`presets\` loads \`defaultPresets\`, and listing your own no longer keeps a default underneath it.`
      : `\`eject: false\` was the default and no longer exists — delete it. \`presets\` is now the complete list.`,

  hooks: () =>
    `\`hooks\` is now a plugin: \`plugins: [{ name: 'my-app', hooks: { ... } }]\`. One mechanism had two spellings, and the nameless one left every diagnostic about a hook with nothing to print. Ordering is now just the order of the array, rather than "plugins in sequence, then the config's own last".`,

  lightningcss: (value) =>
    value
      ? `\`lightningcss: true\` is now \`plugins: [pluginLightningcss()]\` from \`@bamboocss/plugin-lightningcss\`, which you install yourself. The flag forced a static import, so every project carried the native binary whether or not it was on.`
      : `\`lightningcss: false\` was the default and no longer exists — delete it.`,
}

/** Values that no longer exist for an option that does. Keyed by option, then by old value. */
const RETIRED_VALUES: Record<string, Record<string, string>> = {
  validation: {
    none: `\`validation: 'none'\` is now \`validation: 'off'\`, matching \`prune.unresolvedPath\`.`,
  },
}

/** Removed keys nested one level down, keyed by their parent. */
const COMPOSITION_MOVED = (old: string, prop: string) => () =>
  `\`theme.${old}\` is now \`theme.mixins\`, applied through \`css({ mixin: '…' })\` rather than \`css({ ${prop}: '…' })\`. The three keys ran through one registration and differed only in which properties the value could set — an arbitrary partition that cost a bundle spanning two of them a second key and a second application.`

const REMOVED_NESTED: Record<string, Record<string, (value: unknown) => string>> = {
  prune: {
    preflight: (value) =>
      `\`prune.preflight\` is now \`preflight: { prune: ${value === false ? 'false' : 'true'} }\`. It was a second key named \`preflight\` one level away from the one that emits the reset, so a config asked for a reset in one place and reshaped it in another — and pruning a scoped reset already had to read \`preflight.scope\` to work at all.`,
    unresolved: (value) =>
      `\`prune.unresolved\` is now \`prune.unresolvedPath\` — write \`prune: { tokens: true, unresolvedPath: '${value === 'error' ? 'error' : 'warn'}' }\`. The accounting pass it used to switch on runs by default now, so this only decides whether an unfollowable path is reported.`,
  },
  theme: {
    textStyles: COMPOSITION_MOVED('textStyles', 'textStyle'),
    layerStyles: COMPOSITION_MOVED('layerStyles', 'layerStyle'),
    animationStyles: COMPOSITION_MOVED('animationStyles', 'animationStyle'),
  },
}

/**
 * Options a config still sets that no longer exist — a hard error, and not silenceable.
 *
 * Runs ahead of `validation` and ignores it, for the reason `assertNoRetiredSyntax` does. The
 * rest of `validateConfig` reports opinions about a config that will still build; this reports a
 * config that is *provably* not the one being read. An unknown key might be forward-compatible —
 * a setting for a version you have not installed yet — but a key on this list is only reachable
 * by a config written against a version that is behind the one running it.
 *
 * It used to warn, which is the wrong severity for exactly the upgrade this exists to catch. A
 * warning scrolls past in CI, and a removed option is silent in every other way: the build
 * reverts to the default and the assertion the user asked for stops being enforced. These
 * removals ship in minor versions, so a Renovate auto-merge sails through a warning without a
 * person ever reading it — the one case where nothing else can catch it.
 *
 * Every occurrence is collected before throwing, because the point is to fix a config once
 * rather than to be told about it one key at a time. Delete this a release or two after removal,
 * along with `validate-retired-syntax.ts`.
 */
export function assertNoRemovedOptions(config: Partial<UserConfig>): void {
  const found: string[] = []

  validateRemovedOptions(config, (scope, message) => {
    found.push(`- [${scope}] ${message}`)
  })

  if (!found.length) return

  throw new BambooError(
    'CONFIG_ERROR',
    `${found.length} config option(s) no longer exist:\n\n${found.join('\n')}\n\n` +
      `Nothing walks a config for keys it does not recognise, so an option left in place here is ` +
      `reported nowhere else — the build reverts to the default in silence, and any assertion the ` +
      `option asked for stops being enforced. Make the edits above and the build proceeds. This is ` +
      `not governed by \`validation\`, which grades a config that still builds.\n\n` +
      `This reads the config after presets are merged, so a key you cannot find in your own file ` +
      `came from one of them — upgrade that preset, or drop the key with a \`config:resolved\` hook.`,
  )
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

  // `prune.tokens` was a boolean, then three strategies, and is a boolean again. A string is not
  // an unknown key, so nothing else reports it — it would fail to match any branch and silently
  // take the default, which for `'off'` means pruning a project that asked not to be pruned.
  if (typeof dict.prune?.tokens === 'string') {
    const strategy = dict.prune.tokens
    const replacement = strategy === 'off' ? 'false' : 'true'
    const note =
      strategy === 'reachable'
        ? ` \`true\` accounts for each token path individually rather than keeping every declaration the moment javascript reaches for one, so it prunes at least as much and usually far more.`
        : strategy === 'accounted'
          ? ` That is what \`true\` does now; it stopped being something to opt into. Reporting moved to \`prune: { unresolvedPath: 'warn' }\`, which \`'accounted'\` used to imply.`
          : ''

    addError('config', `\`prune.tokens\` takes a boolean now, not a strategy — write \`${replacement}\`.${note}`)
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
