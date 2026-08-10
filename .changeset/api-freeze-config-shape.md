---
'@bamboocss/types': minor
'@bamboocss/config': minor
'@bamboocss/core': minor
'@bamboocss/node': minor
'@bamboocss/generator': minor
'@bamboocss/vite': minor
'@bamboocss/dev': minor
'@bamboocss/parser': minor
'@bamboocss/preset-base': minor
---

**Config options are renamed and removed in this release.** It ships as a minor, so nothing in the version signals it —
the migration notes below are the warning. Every removed or renamed option is reported by name on the next build, with
the edit to make.

Settle the config surface before the API freezes: remove the options that were a second way to say something the config
already said, and rename the ones whose names disagreed with each other.

Every removed or renamed option is reported by name on the next build, with the edit to make. An unknown key is
otherwise ignored in silence, which would mean the build reverting to a default without saying so.

**`strict` now means exactly one thing.** It was six options across three packages covering three unrelated concerns.
`strictTokens` and `strictPropertyValues` are unchanged and are the only remaining use of the word — both narrow
generated TypeScript and neither affects a build.

- `vite.strict` → `vite.failOnUnfolded`. Named for what it checks.
- `PatternConfig.strict` + `PatternConfig.blocklist` → `PatternConfig.cssProps: 'all' | 'none' | { except }`. These were
  two answers to one question, and setting both silently dropped the blocklist — it is only applied to the type that
  `strict: true` does not emit.
- `validation: 'none'` → `validation: 'off'`, matching `prune`.

**`prune` separates the strategy from the report.**

- `prune.tokens` takes `'off' | 'reachable' | 'accounted'` instead of a boolean.
- `prune.unresolved` → `prune.unresolvedPath`, and is now orthogonal: the accounting pass is `tokens: 'accounted'`, the
  severity is `unresolvedPath`. `'off'` used to mean both "do not account" and "do not report", which left "account, and
  stay quiet" unsayable.
- `prune.propertyRegistrations` is new. Dropping unreachable `@property` registrations was a side effect of
  `prune.tokens`, and happened even when it was off — so an option documented as keeping every token declaration quietly
  removed something else, and nothing could keep them.

**Four `global*` keys become one.** `globalCss`, `globalFontface`, `globalPositionTry` and `globalVars` are
`global.css`, `global.fontface`, `global.positionTry` and `global.vars`. `globalVars` was the one of the four
`PresetCore` never listed, so it kept its `extend` wrapper in the resolved config while its siblings lost theirs.

**`themes` becomes `theme.variants`.** One character from `theme`, both spellings valid, so the typo resolved to a
different feature rather than to an error.

**`presets` is authoritative.** What the config lists is what is loaded; an unset `presets` loads `defaultPresets`,
exported from `@bamboocss/dev/presets`. `eject` is removed — `presets: []` is what it meant. Previously, listing any
preset kept `@bamboocss/preset-base` and silently dropped `@bamboocss/preset-bamboo`, so `presets` was neither additive
nor replacing, and `presets: []` meant "base only" rather than "none". A config that lists presets without `preset-base`
now warns, because the change is otherwise silent: `preset-base` carries the utility table, so dropping it changes every
generated class name rather than raising an error.

```ts
import { defaultPresets } from '@bamboocss/dev/presets'

export default defineConfig({ presets: [...defaultPresets, myPreset] })
```

**`lightningcss` is removed; list the plugin instead.** Its only job was to push `pluginLightningcss()` into `plugins`.
Naming the plugin from inside `@bamboocss/node` made it a static import, so `@bamboocss/plugin-lightningcss` — and the
`lightningcss` native binary behind it — installed with every project whether or not the flag was set. It is a separate
package so that cost can be opt-in.

```ts
import { pluginLightningcss } from '@bamboocss/plugin-lightningcss'

export default defineConfig({ plugins: [pluginLightningcss()] })
```

**Fixes**

- `validation` no longer switches off removed-option detection. Setting it to `'none'` returned before that check ran,
  so the one mechanism that tells an upgrader their setting is no longer read was disabled by a severity setting.
- `forceConsistentTypeExtension` now emits import specifiers as `./x.mjs` rather than `./x.d.mts`, which is only legal
  under `allowImportingTsExtensions`. The flag previously emitted imports that did not resolve.
