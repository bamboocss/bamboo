# @bamboocss/config

## 1.36.4

### Patch Changes

- @bamboocss/logger@1.36.4
- @bamboocss/preset-bamboo@1.36.4
- @bamboocss/preset-base@1.36.4
- @bamboocss/shared@1.36.4
- @bamboocss/types@1.36.4

## 1.36.3

### Patch Changes

- @bamboocss/logger@1.36.3
- @bamboocss/preset-bamboo@1.36.3
- @bamboocss/preset-base@1.36.3
- @bamboocss/shared@1.36.3
- @bamboocss/types@1.36.3

## 1.36.2

### Patch Changes

- @bamboocss/logger@1.36.2
- @bamboocss/preset-bamboo@1.36.2
- @bamboocss/preset-base@1.36.2
- @bamboocss/shared@1.36.2
- @bamboocss/types@1.36.2

## 1.36.1

### Patch Changes

- @bamboocss/logger@1.36.1
- @bamboocss/preset-bamboo@1.36.1
- @bamboocss/preset-base@1.36.1
- @bamboocss/shared@1.36.1
- @bamboocss/types@1.36.1

## 1.36.0

### Patch Changes

- @bamboocss/logger@1.36.0
- @bamboocss/preset-bamboo@1.36.0
- @bamboocss/preset-base@1.36.0
- @bamboocss/shared@1.36.0
- @bamboocss/types@1.36.0

## 1.35.5

### Patch Changes

- @bamboocss/logger@1.35.5
- @bamboocss/preset-bamboo@1.35.5
- @bamboocss/preset-base@1.35.5
- @bamboocss/shared@1.35.5
- @bamboocss/types@1.35.5

## 1.35.4

### Patch Changes

- @bamboocss/logger@1.35.4
- @bamboocss/preset-bamboo@1.35.4
- @bamboocss/preset-base@1.35.4
- @bamboocss/shared@1.35.4
- @bamboocss/types@1.35.4

## 1.35.3

### Patch Changes

- @bamboocss/logger@1.35.3
- @bamboocss/preset-bamboo@1.35.3
- @bamboocss/preset-base@1.35.3
- @bamboocss/shared@1.35.3
- @bamboocss/types@1.35.3

## 1.35.2

### Patch Changes

- Updated dependencies [eb3025a]
  - @bamboocss/shared@1.35.2
  - @bamboocss/types@1.35.2
  - @bamboocss/logger@1.35.2
  - @bamboocss/preset-bamboo@1.35.2
  - @bamboocss/preset-base@1.35.2

## 1.35.1

### Patch Changes

- @bamboocss/logger@1.35.1
- @bamboocss/preset-bamboo@1.35.1
- @bamboocss/preset-base@1.35.1
- @bamboocss/shared@1.35.1
- @bamboocss/types@1.35.1

## 1.35.0

### Patch Changes

- Updated dependencies [9bfcf31]
  - @bamboocss/types@1.35.0
  - @bamboocss/logger@1.35.0
  - @bamboocss/preset-bamboo@1.35.0
  - @bamboocss/preset-base@1.35.0
  - @bamboocss/shared@1.35.0

## 1.34.1

### Patch Changes

- @bamboocss/logger@1.34.1
- @bamboocss/preset-bamboo@1.34.1
- @bamboocss/preset-base@1.34.1
- @bamboocss/shared@1.34.1
- @bamboocss/types@1.34.1

## 1.34.0

### Patch Changes

- Updated dependencies [c49ab36]
- Updated dependencies [e66c5f8]
- Updated dependencies [c527ea7]
- Updated dependencies [10bf63d]
- Updated dependencies [c49ab36]
- Updated dependencies [c527ea7]
  - @bamboocss/shared@1.34.0
  - @bamboocss/types@1.34.0
  - @bamboocss/logger@1.34.0
  - @bamboocss/preset-bamboo@1.34.0
  - @bamboocss/preset-base@1.34.0

## 1.33.0

### Minor Changes

- f7bbc14: Move `prune.preflight` onto `preflight`, so one key owns the reset.

  ```ts
  preflight: { scope: '.app', prune: true } // was preflight: { scope: '.app' }, prune: { preflight: true }
  ```

  There were two config keys named `preflight`, one level apart, and a config had to set both to prune a scoped reset —
  asking for the reset in one place and reshaping it in another. They were never independent: pruning reads
  `preflight.scope` to strip the scope before an element can be read out of a selector, and without that the pass
  matches nothing and silently removes nothing.

  `preflight: true` still means on with the defaults, and is _not_ pruned — pruning stays opt-in, since unlike the token
  and keyframe passes there is nothing to prove it against. `scope` is now optional, which it already was at runtime.

  A config still setting `prune.preflight` fails with the edit to make, rather than reverting to the default in silence.
  That matters more here than for most removals: the reset keeps being emitted either way, just unpruned, so nothing
  about the output would have said the setting had stopped being read.

### Patch Changes

- Updated dependencies [f7bbc14]
  - @bamboocss/types@1.33.0
  - @bamboocss/logger@1.33.0
  - @bamboocss/preset-bamboo@1.33.0
  - @bamboocss/preset-base@1.33.0
  - @bamboocss/shared@1.33.0

## 1.32.0

### Minor Changes

- b0ed6dc: Remove the top-level `hooks` config option, so a hook has one place to live.

  Hooks were registrable two ways — through `plugins`, or through a bare `hooks` key on the config, which was treated as
  a nameless plugin appended after all the others. Write a plugin:

  ```ts
  export default defineConfig({
    plugins: [
      {
        name: 'my-app',
        hooks: {
          'tokens:created': ({ configure }) => configure({ formatTokenName: (path) => '$' + path.join('-') }),
        },
      },
    ],
  })
  ```

  One mechanism with two spellings also meant an ordering rule you had to know — "plugins in sequence, then the config's
  own last" — and a diagnostic layer that had a name to print for one spelling and nothing for the other. Ordering is
  now just the order of the array, and every hook belongs to something named.

  A config still setting `hooks` fails naming the replacement, like any other removed option, rather than reverting to
  the default in silence.

  Internally the merged hooks no longer travel on the config object. They were written onto it by `mergeConfigs` and
  read back off in `resolveConfig`, which is what made a `hooks` key ambiguous between "what you wrote" and "what
  resolution produced"; `plugins` is the only source, so `resolveConfig` merges them once and keeps them on
  `LoadConfigResult`. `createContext` from `@bamboocss/fixture` reads hooks from `plugins` for the same reason.

- da792cc: Replace `textStyles`, `layerStyles` and `animationStyles` with one `theme.mixins`.

  The three were one mechanism wearing three names: one registration, one cascade layer, and a `{ description?, value }`
  shape they all shared. They differed only in which css properties the value was allowed to set — a partition that was
  arbitrary at the edges (`color` was legal in a text style _and_ a layer style; `transform` in a layer style but
  `transformOrigin` only in an animation style) and costly in the middle, since a bundle wanting a font _and_ a border
  had to be split across two keys and applied twice.

  ```ts
  // before
  export default defineConfig({
    theme: { textStyles, layerStyles, animationStyles },
  })
  css({ textStyle: 'body' })
  css({ layerStyle: 'card' })

  // after
  export default defineConfig({ theme: { mixins } })
  css({ mixin: 'body' })
  css({ mixin: 'card' })
  ```

  - `defineTextStyles`, `defineLayerStyles` and `defineAnimationStyles` become `defineMixins`.
  - The `text-styles.json`, `layer-styles.json` and `animation-styles.json` specs become `mixins.json`, and the MCP
    tools `get_text_styles`, `get_layer_styles` and `get_animation_styles` become `get_mixins`.
  - Setting a property that does not exist is still an error. `Mixin` is built on the same property set `css()` uses
    rather than on `SystemStyleObject`, whose index signature would accept a typo — which is what the three allowlists
    were really protecting, and why one of them shipped `hypens` for as long as it did.
  - One namespace now holds every mixin, so prefix them by purpose — `text.body`, `layer.card` — if the flat list gets
    long. Nesting already supports this, and `DEFAULT` gives each group a bare name.

  A config still setting one of the three old keys fails with the replacement named, rather than reverting to the
  default in silence.

- b2b4173: Rebuild the themes artifact when a theme variant changes, and carry the original errors on a failed
  extraction.

  **`theme.variants` rebuilt nothing.** The watch rebuild decides which artifacts to regenerate by matching the changed
  config path against a per-artifact list, and the themes artifact still watched `themes` — the option's name before it
  became `theme.variants`. `ConfigPath` ends in `(string & {})`, so the stale path typechecked and simply stopped
  matching.

  Nothing reported it. The diff saw the change, no matcher claimed it, and the affected set came back empty — which is
  not "rebuild everything": `getMatchingArtifacts` filters on `ids.includes(...)`, and an empty list includes nothing.
  So editing or adding a theme variant regenerated no artifact at all and kept serving the previous `theme-*.json`.
  `eject` was stale in the same list, left by the same round of renames.

  A test now checks every watched path against the removed-option table, so an option that is renamed and not updated
  here fails at the commit that renames it rather than silently detaching an artifact from its trigger.

  **`ERR_BAMBOO_EXTRACT_FAILED` carries its causes.** The aggregate named every file it could not extract but kept only
  their messages, so a caller acting on the failure could not tell a retired token spelling from a syntax error. It now
  sets `cause` to an `AggregateError` of the originals — always, one file or six, so reading `cause.errors` never has to
  test how many there were first.

- c29044f: Throw on a config option that no longer exists, instead of warning about it.

  ```
  ERR_BAMBOO_CONFIG_ERROR: 2 config option(s) no longer exist:

  - [config] `pruneUnusedTokens` is now `prune: { tokens: 'reachable' }`.
  - [config] `themes` is now `theme.variants`.
  ```

  Removed-option detection reported every key by name with its replacement, and then warned. A warning is not a signal
  anything acts on: these removals ship in **minor** versions, so a warning is precisely what an automated dependency
  upgrade merges without a person ever reading it — while the option itself is silent in every other way. There is no
  schema walk, so a key that no longer exists is otherwise ignored outright, the build reverts to the default, and any
  assertion the option asked for stops being enforced.

  This is separate from unknown-key tolerance, which is unchanged. An unknown key may be forward-compatible — a setting
  for a version not installed yet. A _removed_ key can only point backwards: it is proof the config predates the version
  reading it.

  Not governed by `validation`, in either direction, for the same reason a retired token spelling is not. That option
  grades opinions about a config that still builds; this is evidence the config is not the one being read. Every
  occurrence is collected before throwing, so a config is fixed in one pass, and the checks run ahead of the ordinary
  findings — a config that predates the version is why the rest disagrees.

  Found one in this repository: `sandbox/waku-ts` still set `themes`, so the app's theme variants were never generated
  while it imported `getTheme` and `injectTheme` from them.

### Patch Changes

- Updated dependencies [c29044f]
- Updated dependencies [b0ed6dc]
- Updated dependencies [8a66bb9]
- Updated dependencies [2b84dfa]
- Updated dependencies [aecf2b1]
- Updated dependencies [da792cc]
- Updated dependencies [1cc1860]
- Updated dependencies [c29044f]
- Updated dependencies [f3a8b0d]
- Updated dependencies [1243f93]
- Updated dependencies [c29044f]
  - @bamboocss/shared@1.32.0
  - @bamboocss/types@1.32.0
  - @bamboocss/preset-base@1.32.0
  - @bamboocss/preset-bamboo@1.32.0
  - @bamboocss/logger@1.32.0

## 1.31.0

### Minor Changes

- 8fb87ac: **Config options are renamed and removed in this release.** It ships as a minor, so nothing in the version
  signals it — the migration notes below are the warning. Every removed or renamed option is reported by name on the
  next build, with the edit to make.

  Settle the config surface before the API freezes: remove the options that were a second way to say something the
  config already said, and rename the ones whose names disagreed with each other.

  Every removed or renamed option is reported by name on the next build, with the edit to make. An unknown key is
  otherwise ignored in silence, which would mean the build reverting to a default without saying so.

  **`strict` now means exactly one thing.** It was six options across three packages covering three unrelated concerns.
  `strictTokens` and `strictPropertyValues` are unchanged and are the only remaining use of the word — both narrow
  generated TypeScript and neither affects a build.
  - `vite.strict` → `vite.failOnUnfolded`. Named for what it checks.
  - `PatternConfig.strict` + `PatternConfig.blocklist` → `PatternConfig.cssProps: 'all' | 'none' | { except }`. These
    were two answers to one question, and setting both silently dropped the blocklist — it is only applied to the type
    that `strict: true` does not emit.
  - `validation: 'none'` → `validation: 'off'`, matching `prune`.

  **`prune` separates the strategy from the report.**
  - `prune.tokens` takes `'off' | 'reachable' | 'accounted'` instead of a boolean.
  - `prune.unresolved` → `prune.unresolvedPath`, and is now orthogonal: the accounting pass is `tokens: 'accounted'`,
    the severity is `unresolvedPath`. `'off'` used to mean both "do not account" and "do not report", which left
    "account, and stay quiet" unsayable.
  - `prune.propertyRegistrations` is new. Dropping unreachable `@property` registrations was a side effect of
    `prune.tokens`, and happened even when it was off — so an option documented as keeping every token declaration
    quietly removed something else, and nothing could keep them.

  **Four `global*` keys become one.** `globalCss`, `globalFontface`, `globalPositionTry` and `globalVars` are
  `global.css`, `global.fontface`, `global.positionTry` and `global.vars`. `globalVars` was the one of the four
  `PresetCore` never listed, so it kept its `extend` wrapper in the resolved config while its siblings lost theirs.

  **`themes` becomes `theme.variants`.** One character from `theme`, both spellings valid, so the typo resolved to a
  different feature rather than to an error.

  **`presets` is authoritative.** What the config lists is what is loaded; an unset `presets` loads `defaultPresets`,
  exported from `@bamboocss/dev/presets`. `eject` is removed — `presets: []` is what it meant. Previously, listing any
  preset kept `@bamboocss/preset-base` and silently dropped `@bamboocss/preset-bamboo`, so `presets` was neither
  additive nor replacing, and `presets: []` meant "base only" rather than "none". A config that lists presets without
  `preset-base` now warns, because the change is otherwise silent: `preset-base` carries the utility table, so dropping
  it changes every generated class name rather than raising an error.

  ```ts
  import { defaultPresets } from '@bamboocss/dev/presets'

  export default defineConfig({ presets: [...defaultPresets, myPreset] })
  ```

  **`lightningcss` is removed; list the plugin instead.** Its only job was to push `pluginLightningcss()` into
  `plugins`. Naming the plugin from inside `@bamboocss/node` made it a static import, so
  `@bamboocss/plugin-lightningcss` — and the `lightningcss` native binary behind it — installed with every project
  whether or not the flag was set. It is a separate package so that cost can be opt-in.

  ```ts
  import { pluginLightningcss } from '@bamboocss/plugin-lightningcss'

  export default defineConfig({ plugins: [pluginLightningcss()] })
  ```

  **Fixes**
  - `validation` no longer switches off removed-option detection. Setting it to `'none'` returned before that check ran,
    so the one mechanism that tells an upgrader their setting is no longer read was disabled by a severity setting.
  - `forceConsistentTypeExtension` now emits import specifiers as `./x.mjs` rather than `./x.d.mts`, which is only legal
    under `allowImportingTsExtensions`. The flag previously emitted imports that did not resolve.

- cd5954c: Group the three prune flags under `prune`, and rename the mode that was called `'strict'`.

  ```ts
  // before
  pruneUnusedTokens: 'strict'
  pruneUnusedKeyframes: false
  prunePreflight: true

  // after
  prune: { unresolved: 'error', keyframes: false, preflight: true }
  ```

  Three options for one concept had drifted apart on all three of naming, default and value type: two said "Unused" and
  one did not, two defaulted to `true` and one to `false`, one took a string and two did not. Each key is independent
  and setting one keeps the defaults for the rest.

  **`'strict'` is now `unresolved: 'error'`.** The word already meant something unrelated in the same config —
  `strictTokens` and `strictPropertyValues` narrow generated _typescript_, and neither implies nor is implied by failing
  a build over a token path. The option is now named for what it checks.

  **`unresolved: 'warn'` is new.** It runs the same accounting as `'error'` and reports the same references without
  failing the build, so a project can read what turning `'error'` on would reject before a build depends on the answer.
  The pruning is identical either way — only whether an unreadable path stops the build differs.

  **Upgrading.** A config still setting a removed option is now reported by name, with the replacement:

  ```
  ⚠️ Invalid config:
  - [config] `pruneUnusedTokens: 'strict'` is now `prune: { unresolved: 'error' }`.
  ```

  That check exists because an unknown config key was otherwise ignored in **silence** — there is no schema walk, so a
  stale `pruneUnusedTokens: 'strict'` would have built clean, pruned by the default instead, and quietly stopped
  enforcing the assertion it asked for. Set `validation: 'error'` to make it fail rather than warn.

  Emitted css is unchanged for an equivalent config; verified byte-identical on three example apps.

  Preset merging is per key: a preset setting `prune: { keyframes: false }` and an app setting
  `prune: { preflight: true }` get both. That needed doing deliberately — `mergeConfigs` deep-merges only the options it
  names and shallow-assigns the rest, so nesting three booleans into an object introduced a way for a preset's setting
  to vanish because an app set a _different_ key. Nothing about the output would have shown it, so it is pinned by a
  test.

- 9fdce28: One way to reference a token from a string: `token(colors.red.300)`. The curly form is gone.

  ```ts
  // before — both worked, and meant the same thing
  css({ color: '{colors.red.300}' })
  css({ color: 'token(colors.red.300)' })

  // after
  css({ color: 'token(colors.red.300)' })
  ```

  The same everywhere a reference can appear: theme and semantic token values, conditions, media queries, style values.

  `token()` was kept rather than `{…}` because it is the readable one — it reads as what it is, it can be searched for,
  and it is already the name of the javascript api that does the same job. Keeping braces would have left the concept
  with two names, one of which is punctuation.

  It also had a hole that made the choice easy: in a theme or semantic token value, `token(colors.red.300)` was never
  expanded at all. It landed in the emitted stylesheet as literal text — invalid css, no warning. That is fixed. The
  fallback form in a theme value, `token(colors.red.300, blue)`, is still not expanded; that is unchanged by this
  release and remains a known gap.

  **Upgrading.** A curly reference left behind does not fail loudly. In a style value the declaration is dropped; in a
  theme value the literal text is emitted. Nothing warns, and config validation cannot report it either, since it is no
  longer a reference to check. Search your config and styles for `{` followed by a token path.

  Emitted css does not change. What changes is that a class name derived from a value containing a reference now spells
  it `token(…)`, since class names encode the value as authored. Verified byte-identical on two real projects, one of
  them a theme with 39 references.

  Token pruning had to be taught the difference between the two things now spelled `token(`. The gate that decides
  whether javascript can reach a token is a text scan, and a reference inside a css value —
  `css({ border: '1px solid token(colors.red.300)' })` — is not javascript reaching a token. Reading it as one turned
  pruning off wholesale, which measured 3.2x the stylesheet on a sandbox: 246 colour declarations where 11 were used. A
  `token(` that survives blanking every string literal is a call; one that does not was written inside a string.

  Config validation understands the new spelling too. It carries its own copy of the reference regex, because it is the
  thing that reports a missing or circular reference — a spelling only the dictionary understood would have been silence
  rather than an error.

  The fallback form is otherwise unchanged: `token(spacing.4, 4)` still means "this token, or this literal if there is
  no such token", which is how the `bleed`, `divider` and `container` patterns accept either a token name or a raw css
  value.

- 678bdee: Remove `token(path, fallback)`. A token is referenced one way: `token(path)`.

  The fallback bundled two unrelated behaviours under one spelling — "resolve this, or use the literal if it names no
  token", answered at build time, and "emit `var(--x, fallback)`", answered by the browser. The call site could not say
  which it was getting, and the build-time half silently masked a typo'd path, which is the same reason the `fallback`
  argument was removed from `token.value()`.

  **Patterns resolve tokens directly now.** `PatternHelpers` gains `token(path, fallback)`:

  ```ts
  // before — deferred into a string for the css pipeline to parse later
  const val = isCssUnit(v) ? v : `token(spacing.${v}, ${v})`

  // after — answered where it can be answered
  const val = isCssUnit(v) ? v : token(`spacing.${v}`, v)
  ```

  Same semantics: `spacer({ size: '4' })` resolves to `var(--spacing-4)`, `spacer({ size: 'auto' })` to `auto`. The
  build, the extractor and the browser answer identically — the browser through the generated tokens artifact, so it
  cannot disagree with the build about a variable's name.

  **What this buys.** `expand-token-references.ts` was a 180-line character-state parser, and every line of it existed
  for the fallback and its nesting. It is now **22 lines and one regex**. That also closes a live bug for free:
  `token(path)` in a theme or semantic token value was never expanded — it landed in the stylesheet as literal text,
  with no warning — because the parser's shape forced a reference regex that could not see it.

  **Breaking.** A retired form now fails rather than emitting text: in a token value the build stops and names the token
  and its replacement; in a style value it throws where it is used.

  `spacer`, `grid` and `bleed` emit `var(--spacing-4)` where they emitted `token(spacing.4, 4)`, so their declarations
  lose a now-redundant css fallback and the class names derived from those values change. Apps not using those three
  patterns are byte-identical — verified on an example app.

  Cost: a pattern module now imports the generated tokens artifact, shared with any other `token()` use in the app.

### Patch Changes

- 8fb87ac: Make `hash`, `prefix` and `preflight` compose across a preset and an app, and wire up `logFilter`.

  **Scalar-shorthand options merge per member.** `hash: true` is shorthand for setting both `cssVar` and `className`;
  `prefix: 'bb'` is shorthand for both. Expanding the scalar before merging is what lets the object forms compose — a
  preset setting `prefix.className` and an app setting `prefix.cssVar` now end up with both.

  Before this the later object replaced the earlier one wholesale, and silently, because the two usually name
  _different_ members: a preset's `hash: { cssVar: true }` under an app's `hash: { className: true }` resolved to just
  `{ className: true }`. Both options take optional members, so writing the partial form that triggers it is the natural
  thing to do.

  `false` remains a statement about the whole option and turns it off outright.

  **`logFilter` does something.** It was declared in the config type and read by nothing. The logger's type filter —
  globs over the namespaced log type, `vite:transform`, `tokens:unresolved`, `prune:tokens`, `config` — was reachable
  only through the `BAMBOO_DEBUG` environment variable, which put it out of reach of a checked-in config. It is now
  settable and applied from the config alongside `logLevel`, so a build can stay at `warn` while one subsystem is
  followed in full.

  ```ts
  export default defineConfig({ logLevel: 'warn', logFilter: 'prune:*' })
  ```

  Also adds coverage for the behaviour introduced by the config reshape, which had none: `theme.variants` merging
  (including its nested `extend`), `prune.propertyRegistrations`, pattern `cssProps`, and the warning when `presets` no
  longer includes `@bamboocss/preset-base`.

- a72eb09: Fail on the retired curly token reference instead of emitting it.

  ```
  1 token value(s) use the retired curly reference syntax:

  - `theme.semanticTokens.colors.fg`: `{colors.red.300}` → `token(colors.red.300)`
  ```

  Removing the syntax left it failing in the two ways hardest to notice: in a style value the declaration was dropped,
  and in a token value the text was emitted into the stylesheet as-is. Neither reported itself, and neither is valid css
  — so the previous release said "search for it when upgrading", which is not a diagnostic.

  It is safe to throw rather than warn because the spelling was never available for anything else. Until it was removed,
  `{…}` in a value was consumed unconditionally — braces stripped, an unresolved path emitted bare — so no literal
  `{a.b}` could have survived to mean itself. There is no legitimate use to break, which is what separates this from a
  strict-mode opinion.

  Token values are checked ahead of `validation`, and throw even under `validation: 'none'`: that opts out of opinions
  about a config that will still build, and this is not one. Every occurrence is collected first, so a config is fixed
  in one pass rather than one token at a time.

  Style values throw where they are used, through the one hook every value already passes. A brace that is not a
  reference is left alone — whitespace, quotes and `:` are excluded, so a `content` string holding json-ish text is not
  mistaken for one.

- Updated dependencies [8fb87ac]
- Updated dependencies [8fb87ac]
- Updated dependencies [cd5954c]
- Updated dependencies [9c32b00]
- Updated dependencies [8fb87ac]
- Updated dependencies [678bdee]
- Updated dependencies [774048b]
  - @bamboocss/types@1.31.0
  - @bamboocss/preset-base@1.31.0
  - @bamboocss/logger@1.31.0
  - @bamboocss/shared@1.31.0
  - @bamboocss/preset-bamboo@1.31.0

## 1.30.1

### Patch Changes

- @bamboocss/logger@1.30.1
- @bamboocss/preset-bamboo@1.30.1
- @bamboocss/preset-base@1.30.1
- @bamboocss/shared@1.30.1
- @bamboocss/types@1.30.1

## 1.30.0

### Patch Changes

- Updated dependencies
- Updated dependencies [242b24c]
  - @bamboocss/types@1.30.0
  - @bamboocss/shared@1.30.0
  - @bamboocss/logger@1.30.0
  - @bamboocss/preset-bamboo@1.30.0
  - @bamboocss/preset-base@1.30.0

## 1.29.0

### Patch Changes

- Updated dependencies [0dbe9c4]
- Updated dependencies [6114f6e]
- Updated dependencies [38393c4]
  - @bamboocss/types@1.29.0
  - @bamboocss/logger@1.29.0
  - @bamboocss/preset-bamboo@1.29.0
  - @bamboocss/preset-base@1.29.0
  - @bamboocss/shared@1.29.0

## 1.28.1

### Patch Changes

- Updated dependencies [31749e1]
- Updated dependencies [be39dac]
  - @bamboocss/types@1.28.1
  - @bamboocss/logger@1.28.1
  - @bamboocss/preset-bamboo@1.28.1
  - @bamboocss/preset-base@1.28.1
  - @bamboocss/shared@1.28.1

## 1.28.0

### Patch Changes

- Updated dependencies [d7fc408]
  - @bamboocss/types@1.28.0
  - @bamboocss/logger@1.28.0
  - @bamboocss/preset-bamboo@1.28.0
  - @bamboocss/preset-base@1.28.0
  - @bamboocss/shared@1.28.0

## 1.27.0

### Patch Changes

- @bamboocss/logger@1.27.0
- @bamboocss/preset-bamboo@1.27.0
- @bamboocss/preset-base@1.27.0
- @bamboocss/shared@1.27.0
- @bamboocss/types@1.27.0

## 1.26.0

### Patch Changes

- @bamboocss/logger@1.26.0
- @bamboocss/preset-bamboo@1.26.0
- @bamboocss/preset-base@1.26.0
- @bamboocss/shared@1.26.0
- @bamboocss/types@1.26.0

## 1.25.0

### Patch Changes

- @bamboocss/logger@1.25.0
- @bamboocss/preset-bamboo@1.25.0
- @bamboocss/preset-base@1.25.0
- @bamboocss/shared@1.25.0
- @bamboocss/types@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/logger@1.24.0
- @bamboocss/preset-bamboo@1.24.0
- @bamboocss/preset-base@1.24.0
- @bamboocss/shared@1.24.0
- @bamboocss/types@1.24.0

## 1.23.0

### Patch Changes

- Updated dependencies [b041398]
- Updated dependencies [087b884]
  - @bamboocss/types@1.23.0
  - @bamboocss/shared@1.23.0
  - @bamboocss/logger@1.23.0
  - @bamboocss/preset-bamboo@1.23.0
  - @bamboocss/preset-base@1.23.0

## 1.22.0

### Patch Changes

- Updated dependencies [fe62614]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
  - @bamboocss/types@1.22.0
  - @bamboocss/shared@1.22.0
  - @bamboocss/logger@1.22.0
  - @bamboocss/preset-bamboo@1.22.0
  - @bamboocss/preset-base@1.22.0

## 1.21.0

### Patch Changes

- Updated dependencies [81f8789]
  - @bamboocss/shared@1.21.0
  - @bamboocss/types@1.21.0
  - @bamboocss/logger@1.21.0
  - @bamboocss/preset-bamboo@1.21.0
  - @bamboocss/preset-base@1.21.0

## 1.20.4

### Patch Changes

- @bamboocss/logger@1.20.4
- @bamboocss/preset-bamboo@1.20.4
- @bamboocss/preset-base@1.20.4
- @bamboocss/shared@1.20.4
- @bamboocss/types@1.20.4

## 1.20.3

### Patch Changes

- @bamboocss/logger@1.20.3
- @bamboocss/preset-bamboo@1.20.3
- @bamboocss/preset-base@1.20.3
- @bamboocss/shared@1.20.3
- @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- @bamboocss/logger@1.20.2
- @bamboocss/preset-bamboo@1.20.2
- @bamboocss/preset-base@1.20.2
- @bamboocss/shared@1.20.2
- @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

- @bamboocss/logger@1.20.1
- @bamboocss/preset-bamboo@1.20.1
- @bamboocss/preset-base@1.20.1
- @bamboocss/shared@1.20.1
- @bamboocss/types@1.20.1

## 1.20.0

### Patch Changes

- 0e2cb31: Stop breakpoints in an unrecognised unit being read as pixels.

  `getUnit` matched anywhere in a string and only in lower case, and the conversions ran `parseFloat` over the raw
  value. `parseFloat` returns a number for plenty of strings that are not a pixel count, so a unit the conversion did
  not recognise was silently treated as one. Two ways to reach it, both producing valid CSS that matches the wrong
  viewports or none:

  | breakpoints        | `mdOnly` emitted                               | should be                                        |
  | ------------------ | ---------------------------------------------- | ------------------------------------------------ |
  | `50EM`             | `(min-width: 40EM) and (max-width: 3.1225rem)` | `(min-width: 40rem) and (max-width: 49.9975rem)` |
  | `calc(40em + 0px)` | `(min-width: NaNrem)`                          | the value, unchanged                             |
  | `50vw`             | `(max-width: 3.1225rem)`                       | `(max-width: 50vw)`                              |

  `40EM` is as valid as `40em`; CSS units are case-insensitive. Reading it as `40px` made the range sixteen times too
  small, so `min-width: 640px` and `max-width: 50px` matched nothing at all. `validateBreakpoints` did not catch any of
  it, because it asked the same function and fell back to `px` for whatever came back empty — a theme written entirely
  in `EM`, or mixing `em` with `vw`, passed the same-unit check.

  Now:
  - Unit matching is anchored and case-insensitive, so a unit inside a larger expression is not mistaken for the value's
    own, and `40EM` converts exactly as `40em` does. The number accepts what CSS accepts, including `.5rem` and `1e3px`.
  - The numeric half is read from the match rather than by `parseFloat` over the raw string, so a value that is not a
    number and a unit is passed through untouched instead of becoming `NaN`.
  - Breakpoint arithmetic only steps a value down when it is in a unit that converts to pixels. Anything else — `vw`,
    `ch`, a `calc()` — is emitted as written. That costs an overlap of one unit between adjacent ranges, against a range
    that previously matched nothing. (Superseded in the same release: range syntax removed the step entirely, so these
    units no longer overlap either.)
  - `validateBreakpoints` reads the unit generically, so it can tell `em` from `EM` from `vw` and its same-unit check
    works for units bamboo does not convert.

  `unit-conversion.ts` had no test file. It has one now, along with breakpoint cases for each shape above.

- Updated dependencies [045ab1e]
- Updated dependencies [5d2c91c]
- Updated dependencies [10d7c9b]
- Updated dependencies [aa0f641]
- Updated dependencies [0e2cb31]
  - @bamboocss/preset-base@1.20.0
  - @bamboocss/types@1.20.0
  - @bamboocss/shared@1.20.0
  - @bamboocss/logger@1.20.0
  - @bamboocss/preset-bamboo@1.20.0

## 1.19.0

### Patch Changes

- @bamboocss/logger@1.19.0
- @bamboocss/preset-bamboo@1.19.0
- @bamboocss/preset-base@1.19.0
- @bamboocss/shared@1.19.0
- @bamboocss/types@1.19.0

## 1.18.0

### Patch Changes

- Updated dependencies [21c6daa]
- Updated dependencies [112cb85]
  - @bamboocss/shared@1.18.0
  - @bamboocss/preset-base@1.18.0
  - @bamboocss/types@1.18.0
  - @bamboocss/logger@1.18.0
  - @bamboocss/preset-bamboo@1.18.0

## 1.17.3

### Patch Changes

- @bamboocss/types@1.17.3
- @bamboocss/logger@1.17.3
- @bamboocss/preset-bamboo@1.17.3
- @bamboocss/preset-base@1.17.3
- @bamboocss/shared@1.17.3

## 1.17.2

### Patch Changes

- Updated dependencies [7c81ec9]
- Updated dependencies [bf2d9c5]
  - @bamboocss/preset-base@1.17.2
  - @bamboocss/logger@1.17.2
  - @bamboocss/preset-bamboo@1.17.2
  - @bamboocss/shared@1.17.2
  - @bamboocss/types@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [fc381ca]
  - @bamboocss/shared@1.17.1
  - @bamboocss/types@1.17.1
  - @bamboocss/logger@1.17.1
  - @bamboocss/preset-bamboo@1.17.1
  - @bamboocss/preset-base@1.17.1

## 1.17.0

### Patch Changes

- Updated dependencies [3cdd0d1]
- Updated dependencies [d5347ab]
- Updated dependencies [c6154dc]
- Updated dependencies [355e573]
  - @bamboocss/shared@1.17.0
  - @bamboocss/preset-base@1.17.0
  - @bamboocss/types@1.17.0
  - @bamboocss/logger@1.17.0
  - @bamboocss/preset-bamboo@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/types@1.16.1
- @bamboocss/logger@1.16.1
- @bamboocss/preset-bamboo@1.16.1
- @bamboocss/preset-base@1.16.1
- @bamboocss/shared@1.16.1

## 1.16.0

### Minor Changes

- f2d5df2: **Breaking:** remove the JSX factory. Bamboo no longer generates components, and is now framework-agnostic.

  `styled-system/jsx` is not emitted at all. `styled` / `bamboo`, style props, the `css` prop, `as`, `unstyled`,
  `createStyleContext`, `splitCssProps` and `isCssProperty` are gone, along with `jsxFramework`, `jsxFactory` and
  `jsxStyleProps`. There is no React, Vue, Solid, Preact or Qwik codegen left anywhere.

  ```tsx
  // before
  <styled.div color="red.300" padding="4">hi</styled.div>
  const Button = styled('button', buttonRecipe)

  // after
  <div className={css({ color: 'red.300', padding: '4' })}>hi</div>
  const Button = (props: ButtonProps) => {
    const [variantProps, rest] = buttonRecipe.splitVariantProps(props)
    return <button {...rest} className={cx(buttonRecipe(variantProps), props.className)} />
  }
  ```

  For an override to be deterministic the component's styles have to sit in a lower cascade layer, which means declaring
  them as a config recipe — an inline `cva()` is atomic and lands in `utilities` alongside the consumer. A component
  that instead accepts a style object and merges it with `css(base, props.css)` needs no layer at all.

  **Recipe JSX tracking is kept**, and no longer depends on `jsxFramework`. A recipe's `jsx: ['Button']` hint is how the
  build reads `<Button variant="danger">` on a component you wrote and emits `--variant_danger`; without it those
  variants would silently stop being generated. It costs no codegen — it is extraction only.

  **`createStyleContext` has no replacement in the box.** Compound components that need one slot to see the variant
  chosen at the root now write their own context; `docs/concepts/slot-recipes` documents the ~20-line version.

  What this removes beyond the API: the whole per-framework generator tree, `is-valid-prop` (a large module that shipped
  to the browser only to decide whether a prop was a style prop), `normalize-html`, the vite fold's JSX element path —
  which has nothing left to fold — and the per-framework test matrix.

  `@bamboocss/plugin-vue` and `@bamboocss/plugin-svelte` are unaffected: they transform source so the extractor can read
  it, which has nothing to do with the factory.

- 1dbeb84: **Breaking:** remove JSX pattern components.

  `styled-system/jsx` no longer emits a component per pattern — `<Stack>`, `<Box>`, `<HStack>` and the rest are gone,
  and `styled-system/jsx` now exports only the factory, `isCssProperty` and `createStyleContext`.

  Pattern **functions** are unchanged. Every pattern still ships from `styled-system/patterns`, and a pattern function
  passes arbitrary style props through, so the rewrite is mechanical and behaviour-preserving:

  ```tsx
  // before
  <Stack gap="4" mt="8">{children}</Stack>
  <Box p="4">{children}</Box>

  // after
  <div className={stack({ gap: '4', mt: '8' })}>{children}</div>
  <div className={css({ p: '4' })}>{children}</div>
  ```

  The `jsx`, `jsxName` and `jsxElement` fields on a pattern config are removed along with them — they only ever
  described a component bamboo generated. `jsx` on a **recipe** is untouched.

  Everything that existed to serve the component layer goes with it: the five per-framework pattern generators, the
  `jsx-patterns` artifact, the parser's `jsx-pattern` result type and `JsxEngine`'s pattern matcher, and the vite fold's
  pattern-element path. `Patterns.find`/`Patterns.filter` (both keyed by JSX name) are gone, and
  `StyleEncoder.processPattern` takes `(name, props, grouped)`.

  Two consequences worth knowing:
  - A component of your own named `Box` or `Stack` is no longer misread as bamboo's pattern. It extracts as an ordinary
    component, which is what it always was.
  - The `jsx-patterns-index` artifact is now `jsx-index`, since it no longer indexes patterns.

- d7226f0: **Breaking:** remove template literal syntax.

  The `syntax` config option is gone, along with the `--syntax` CLI flag and the syntax question `bamboo init -i` asked.
  Styles are written as objects.

  A project that set `syntax: 'template-literal'` now gets a TypeScript error on the option, and its tagged templates
  are no longer read by the extractor — `` css`color: red;` `` and `` styled.div`color: red;` `` produce no CSS. Convert
  them to object literals:

  ```tsx
  // before
  const One = styled.div`
    display: flex;
    width: 300px;
  `

  // after
  const One = styled('div', {
    base: {
      display: 'flex',
      width: '300px',
    },
  })
  ```

  Everything the option gated goes with it: the string-literal `css`/`conditions` runtimes and the string-literal JSX
  factories and types for all five frameworks, the parser's tagged-template branch, the extractor's `taggedTemplates`
  matcher, the vite fold's tagged-template path, and `astish` from `@bamboocss/shared`. Under the object syntax `cva`,
  `sva`, patterns, `is-valid-prop`, style props and `viewTransition()` were already the only paths taken, so their
  generated output is unchanged — the codegen artifacts are byte-identical.

- 31d8577: **Breaking:** `scopeRoot: 'x'` becomes `scopeRoots: ['x']`, and a slot recipe can now name more than one
  anchor.

  A portal is a real break in the DOM tree, and no CSS mechanism crosses one — not inheritance, not
  `@container style()`, not `:has()`. A `<Select>` occupies two disjoint subtrees: the trigger side under `root`, the
  listbox side under a portaled `positioner`. A variant writes styles into both. One anchor can only ever reach one of
  them.

  That was not a limitation you could work around by choosing the right anchor — it only picked which half worked:

  ```ts
  scopeRoot: 'root' // 7 slots scoped, the 8 portaled ones get rules that never match
  scopeRoot: 'positioner' // 8 slots scoped, the 7 in-tree ones get rules that never match
  ```

  And the failure was quiet. Base slot styles are emitted outside the scope, so they still applied and the component
  rendered _nearly_ right — a partial failure, harder to notice than a total one.

  ```ts
  defineSlotRecipe({
    className: 'select',
    slots: ['root', 'trigger', 'positioner', 'content', 'item'],
    scopeRoots: ['root', 'positioner'],
    variants: { size: { lg: { trigger: { h: '11' }, item: { px: '3' } } } },
  })
  ```

  Each named slot takes variant props; every other slot stays a constant. Anchors are callable, so the variant still has
  to be delivered to each of them — in a compound component the consumer authors `Select.Positioner` as a sibling of
  `Select.Root`, so it needs one context to reach it. That is one delivery per _subtree the component occupies_, not per
  slot: 2 instead of 8, and the count does not grow as the recipe gains slots.

  ### No structural declaration

  You never describe the DOM. Each non-anchor slot's variant rules are emitted under **every** anchor, and only the
  anchor that is genuinely an ancestor matches at runtime. Nested anchors resolve by `@scope` proximity — the nearer one
  wins.

  Read `scopeRoots` as a cost control rather than a description of the tree: emitting every slot under every slot would
  be correct with nothing declared at all, it is just quadratic in slot count. Naming the enclosing slots prunes it to
  one copy per anchor.

  ### Cost, measured

  A 15-slot recipe shaped like Park UI's `select`, two variants over five values:

  ```
  1 anchor    raw 2,315 B   gzip 310 B    5 @scope blocks
  2 anchors   raw 4,248 B   gzip 383 B   10 @scope blocks
  ```

  +84% raw, **+24% gzipped**. The alternative — per-slot variant classes for the portaled half — gzips to 502 B,
  _larger_ than two anchors, and still needs a runtime channel to deliver those classes.

  Getting there needed a fix in the stylesheet: scoped rules are keyed by their `@scope` prelude, and identical at-rules
  only collapse when adjacent. Interleaving two anchors broke that, giving 130 blocks where 10 would do. Scoped results
  are now merged per layer before processing, so the prelude deduplicates as an object key. Unscoped output is untouched
  — merging those would also collapse a variant's declarations into one rule and reorder the layer.

  ### Other changes
  - `scopeRoots: []` explicitly turns scoping off, giving every slot its own variant class. Previously reachable only by
    _not_ having a slot named `root`.
  - A slot recipe's generated type now declares every anchor as callable, not just one.
  - Fixed: `slotScopes` was only ever written, never cleared, so a recipe that _stopped_ being scoped in a watch rebuild
    kept emitting rules under an anchor nothing rendered any more.

  ### What this does not fix

  A slot under _no_ anchor is still unreachable, and nothing at build time can detect it — reachability is a fact about
  the DOM, and there is no component layer left to check it at runtime. `scopeRoots` makes the correct thing
  expressible; it does not make it verifiable. `recipe.slotsAffectedBy` remains the tool for whatever still needs
  threading by hand.

- ca558fb: Let a slot recipe name the slot its variants scope by, with `scopeRoot`.

  Scoping a slot recipe's variants to its root needs an enclosing slot to anchor on, and until now that had to be a slot
  literally named `root`. A component library's wrapper is not always called that — and sometimes the slot called `root`
  renders no DOM element at all, which is the case that makes this necessary rather than convenient. A menu whose only
  real ancestor is `positioner` had no way in.

  ```ts
  defineSlotRecipe({
    className: 'menu',
    slots: ['trigger', 'positioner', 'item'],
    scopeRoot: 'positioner',
    variants: { size: { sm: { item: { padding: '2' } } } },
  })
  ```

  `item` is inside `positioner`, so its variant styles are emitted as rules scoped by the class `positioner` carries,
  and its own class stays constant. Unset, the default is still a slot named `root`, so nothing changes for recipes that
  have one.

  Only slots rendered _inside_ the named one are reached. A slot a portal moves out of that subtree is not — `trigger`
  above is a sibling — and needs its variant delivered by hand. `recipe.slotsAffectedBy` says which slots each variant
  actually writes styles for, so only those need threading.

  A `scopeRoot` naming a slot the recipe does not declare is now a config error rather than a silent fallback to
  per-slot variant classes, which would have looked correct while quietly reinstating the runtime distribution the
  recipe was written to avoid.

### Patch Changes

- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [091f2e1]
- Updated dependencies [f2d5df2]
- Updated dependencies [1dbeb84]
- Updated dependencies [d7226f0]
- Updated dependencies [31d8577]
- Updated dependencies [2ab7f19]
- Updated dependencies [ca558fb]
  - @bamboocss/shared@1.16.0
  - @bamboocss/types@1.16.0
  - @bamboocss/preset-base@1.16.0
  - @bamboocss/logger@1.16.0
  - @bamboocss/preset-bamboo@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/shared@1.15.0
  - @bamboocss/types@1.15.0
  - @bamboocss/logger@1.15.0
  - @bamboocss/preset-bamboo@1.15.0
  - @bamboocss/preset-base@1.15.0

## 1.14.0

### Patch Changes

- Updated dependencies [b567114]
- Updated dependencies [d1d05fc]
  - @bamboocss/types@1.14.0
  - @bamboocss/shared@1.14.0
  - @bamboocss/logger@1.14.0
  - @bamboocss/preset-bamboo@1.14.0
  - @bamboocss/preset-base@1.14.0

## 1.13.2

### Patch Changes

- Updated dependencies [79c9872]
- Updated dependencies [61fe88c]
- Updated dependencies [be3764d]
- Updated dependencies [7a63215]
- Updated dependencies [2130606]
  - @bamboocss/shared@1.13.2
  - @bamboocss/types@1.13.2
  - @bamboocss/logger@1.13.2
  - @bamboocss/preset-bamboo@1.13.2
  - @bamboocss/preset-base@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/logger@1.13.1
- @bamboocss/preset-bamboo@1.13.1
- @bamboocss/preset-base@1.13.1
- @bamboocss/shared@1.13.1
- @bamboocss/types@1.13.1

## 1.13.0

### Patch Changes

- Updated dependencies [9ffb84f]
- Updated dependencies [e482ab3]
- Updated dependencies [7bf6798]
- Updated dependencies [11c9409]
- Updated dependencies [9ffb84f]
- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [9ffb84f]
- Updated dependencies [a966bae]
  - @bamboocss/shared@1.13.0
  - @bamboocss/types@1.13.0
  - @bamboocss/logger@1.13.0
  - @bamboocss/preset-bamboo@1.13.0
  - @bamboocss/preset-base@1.13.0

## 1.12.3

### Patch Changes

- @bamboocss/logger@1.12.3
- @bamboocss/preset-bamboo@1.12.3
- @bamboocss/preset-base@1.12.3
- @bamboocss/shared@1.12.3
- @bamboocss/types@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/logger@1.12.2
- @bamboocss/preset-bamboo@1.12.2
- @bamboocss/preset-base@1.12.2
- @bamboocss/shared@1.12.2
- @bamboocss/types@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/logger@1.12.1
- @bamboocss/preset-bamboo@1.12.1
- @bamboocss/preset-base@1.12.1
- @bamboocss/shared@1.12.1
- @bamboocss/types@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/logger@1.12.0
- @bamboocss/preset-bamboo@1.12.0
- @bamboocss/preset-base@1.12.0
- @bamboocss/shared@1.12.0
- @bamboocss/types@1.12.0

## 1.11.5

### Patch Changes

- f3591d8: Fix chunk splitting in build output that produced unstable hashed filenames in published packages.
  - Build each entry point independently to prevent shared-code extraction into chunk files
  - Fix build ordering race condition where studio postbuild could run before CLI was ready
  - @bamboocss/logger@1.11.5
  - @bamboocss/preset-bamboo@1.11.5
  - @bamboocss/preset-base@1.11.5
  - @bamboocss/shared@1.11.5
  - @bamboocss/types@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/logger@1.11.4
  - @bamboocss/preset-bamboo@1.11.4
  - @bamboocss/preset-base@1.11.4
  - @bamboocss/shared@1.11.4
  - @bamboocss/types@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/logger@1.11.3
  - @bamboocss/preset-bamboo@1.11.3
  - @bamboocss/preset-base@1.11.3
  - @bamboocss/shared@1.11.3
  - @bamboocss/types@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/preset-bamboo@1.11.2
  - @bamboocss/preset-base@1.11.2
  - @bamboocss/logger@1.11.2
  - @bamboocss/shared@1.11.2
  - @bamboocss/types@1.11.2

## 1.11.1

### Patch Changes

- Updated dependencies [2ea9205]
  - @bamboocss/types@1.11.1
  - @bamboocss/logger@1.11.1
  - @bamboocss/preset-base@1.11.1
  - @bamboocss/preset-bamboo@1.11.1
  - @bamboocss/shared@1.11.1

## 1.11.0

### Minor Changes

- 78869ae: ### Added: Multi-block conditions with object syntax

  Allow a single condition to generate multiple independent CSS blocks using a declarative object syntax with `@slot`
  markers.

  This is useful for defining conditions like hover-for-desktop + active-for-touch in one condition, where each block
  needs its own at-rule.

  **Config:**

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    conditions: {
      extend: {
        hoverActive: {
          '@media (hover: hover)': {
            '&:is(:hover, [data-hover])': '@slot',
          },
          '@media (hover: none)': {
            '&:is(:active, [data-active])': '@slot',
          },
        },
      },
    },
  })
  ```

  **Usage:**

  ```ts
  css({ _hoverActive: { bg: 'red' } })
  ```

  **Generated CSS:**

  ```css
  @media (hover: hover) {
    .hoverActive\:bg_red:is(:hover, [data-hover]) {
      background: red;
    }
  }
  @media (hover: none) {
    .hoverActive\:bg_red:is(:active, [data-active]) {
      background: red;
    }
  }
  ```

  This is backward compatible — existing `string` and `string[]` conditions continue to work as before.

### Patch Changes

- Updated dependencies [78869ae]
  - @bamboocss/types@1.11.0
  - @bamboocss/logger@1.11.0
  - @bamboocss/preset-base@1.11.0
  - @bamboocss/preset-bamboo@1.11.0
  - @bamboocss/shared@1.11.0

## 1.10.0

### Minor Changes

- bbaa8b3: - Extract Vue, Svelte, and LightningCSS support into standalone plugins.
  - Fix double CSS optimization in PostCSS plugin.

### Patch Changes

- c31f3a2: Improve error handling architecture across all packages.
- 44457bb: Use TypeScript 6.0 or later with Bamboo. This release updates static analysis and codegen to ts-morph v28 and
  TypeScript 6.0.2.
- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [8d3b6f8]
- Updated dependencies [44457bb]
  - @bamboocss/types@1.10.0
  - @bamboocss/logger@1.10.0
  - @bamboocss/shared@1.10.0
  - @bamboocss/preset-base@1.10.0
  - @bamboocss/preset-bamboo@1.10.0

## 1.9.1

### Patch Changes

- Updated dependencies [028e755]
  - @bamboocss/preset-base@1.9.1
  - @bamboocss/logger@1.9.1
  - @bamboocss/preset-bamboo@1.9.1
  - @bamboocss/shared@1.9.1
  - @bamboocss/types@1.9.1

## 1.9.0

### Patch Changes

- @bamboocss/logger@1.9.0
- @bamboocss/preset-base@1.9.0
- @bamboocss/preset-bamboo@1.9.0
- @bamboocss/shared@1.9.0
- @bamboocss/types@1.9.0

## 1.8.2

### Patch Changes

- Updated dependencies [331d1a5]
  - @bamboocss/types@1.8.2
  - @bamboocss/logger@1.8.2
  - @bamboocss/preset-base@1.8.2
  - @bamboocss/preset-bamboo@1.8.2
  - @bamboocss/shared@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies [3c86c29]
  - @bamboocss/types@1.8.1
  - @bamboocss/logger@1.8.1
  - @bamboocss/preset-base@1.8.1
  - @bamboocss/preset-bamboo@1.8.1
  - @bamboocss/shared@1.8.1

## 1.8.0

### Patch Changes

- @bamboocss/logger@1.8.0
- @bamboocss/preset-base@1.8.0
- @bamboocss/preset-bamboo@1.8.0
- @bamboocss/shared@1.8.0
- @bamboocss/types@1.8.0

## 1.7.3

### Patch Changes

- Updated dependencies [ac2fb5c]
  - @bamboocss/preset-base@1.7.3
  - @bamboocss/logger@1.7.3
  - @bamboocss/preset-bamboo@1.7.3
  - @bamboocss/shared@1.7.3
  - @bamboocss/types@1.7.3

## 1.7.2

### Patch Changes

- @bamboocss/logger@1.7.2
- @bamboocss/preset-base@1.7.2
- @bamboocss/preset-bamboo@1.7.2
- @bamboocss/shared@1.7.2
- @bamboocss/types@1.7.2

## 1.7.1

### Patch Changes

- cc04ebf: Fix issue where `@bamboocss/config` CJS entrypoint is broken due to `merge-anything` ESM-only dependency.
- Updated dependencies [b6e9646]
  - @bamboocss/preset-base@1.7.1
  - @bamboocss/logger@1.7.1
  - @bamboocss/preset-bamboo@1.7.1
  - @bamboocss/shared@1.7.1
  - @bamboocss/types@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [86b30b1]
  - @bamboocss/types@1.7.0
  - @bamboocss/logger@1.7.0
  - @bamboocss/preset-base@1.7.0
  - @bamboocss/preset-bamboo@1.7.0
  - @bamboocss/shared@1.7.0

## 1.6.1

### Patch Changes

- @bamboocss/logger@1.6.1
- @bamboocss/preset-base@1.6.1
- @bamboocss/preset-bamboo@1.6.1
- @bamboocss/shared@1.6.1
- @bamboocss/types@1.6.1

## 1.6.0

### Patch Changes

- @bamboocss/logger@1.6.0
- @bamboocss/preset-base@1.6.0
- @bamboocss/preset-bamboo@1.6.0
- @bamboocss/shared@1.6.0
- @bamboocss/types@1.6.0

## 1.5.1

### Patch Changes

- @bamboocss/logger@1.5.1
- @bamboocss/preset-base@1.5.1
- @bamboocss/preset-bamboo@1.5.1
- @bamboocss/shared@1.5.1
- @bamboocss/types@1.5.1

## 1.5.0

### Minor Changes

- 91c65ff: Add support for controlling the color palette generation via `theme.colorPalette` property.

  ```ts
  // Disable color palette generation completely
  export default defineConfig({
    theme: {
      colorPalette: {
        enabled: false,
      },
    },
  })

  // Include only specific colors
  export default defineConfig({
    theme: {
      colorPalette: {
        include: ['gray', 'blue', 'red'],
      },
    },
  })

  // Exclude specific colors
  export default defineConfig({
    theme: {
      colorPalette: {
        exclude: ['yellow', 'orange'],
      },
    },
  })
  ```

### Patch Changes

- Updated dependencies [91c65ff]
  - @bamboocss/types@1.5.0
  - @bamboocss/logger@1.5.0
  - @bamboocss/preset-base@1.5.0
  - @bamboocss/preset-bamboo@1.5.0
  - @bamboocss/shared@1.5.0

## 1.4.3

### Patch Changes

- 84a0de9: Improve static CSS generation performance with wildcard memoization. Token lookups for wildcard (`*`)
  expansions are now cached, providing ~32% faster processing for large configs with wildcards.
  - @bamboocss/logger@1.4.3
  - @bamboocss/preset-base@1.4.3
  - @bamboocss/preset-bamboo@1.4.3
  - @bamboocss/shared@1.4.3
  - @bamboocss/types@1.4.3

## 1.4.2

### Patch Changes

- 0679f6f: Fix issue where `create-recipe.mjs` helper was not generated when adding the first recipe to a project that
  previously had no recipes.
- Updated dependencies [1290a27]
  - @bamboocss/shared@1.4.2
  - @bamboocss/types@1.4.2
  - @bamboocss/logger@1.4.2
  - @bamboocss/preset-base@1.4.2
  - @bamboocss/preset-bamboo@1.4.2

## 1.4.1

### Patch Changes

- @bamboocss/logger@1.4.1
- @bamboocss/preset-base@1.4.1
- @bamboocss/preset-bamboo@1.4.1
- @bamboocss/shared@1.4.1
- @bamboocss/types@1.4.1

## 1.4.0

### Patch Changes

- Updated dependencies [1bca361]
- Updated dependencies [29cf719]
  - @bamboocss/preset-base@1.4.0
  - @bamboocss/preset-bamboo@1.4.0
  - @bamboocss/logger@1.4.0
  - @bamboocss/shared@1.4.0
  - @bamboocss/types@1.4.0

## 1.3.1

### Patch Changes

- @bamboocss/logger@1.3.1
- @bamboocss/preset-base@1.3.1
- @bamboocss/preset-bamboo@1.3.1
- @bamboocss/shared@1.3.1
- @bamboocss/types@1.3.1

## 1.3.0

### Patch Changes

- Updated dependencies [70efd73]
- Updated dependencies [1c36121]
  - @bamboocss/types@1.3.0
  - @bamboocss/preset-base@1.3.0
  - @bamboocss/logger@1.3.0
  - @bamboocss/preset-bamboo@1.3.0
  - @bamboocss/shared@1.3.0

## 1.2.0

### Patch Changes

- Updated dependencies [ae7cc8d]
- Updated dependencies [9964772]
  - @bamboocss/preset-bamboo@1.2.0
  - @bamboocss/preset-base@1.2.0
  - @bamboocss/logger@1.2.0
  - @bamboocss/shared@1.2.0
  - @bamboocss/types@1.2.0

## 1.1.0

### Minor Changes

- e8ec0aa: Add support for `preset:resolved` hook to pick/omit specific preset properties.

### Patch Changes

- Updated dependencies [47a0011]
- Updated dependencies [e8ec0aa]
  - @bamboocss/types@1.1.0
  - @bamboocss/shared@1.1.0
  - @bamboocss/logger@1.1.0
  - @bamboocss/preset-base@1.1.0
  - @bamboocss/preset-bamboo@1.1.0

## 1.0.1

### Patch Changes

- Updated dependencies [0019184]
  - @bamboocss/preset-base@1.0.1
  - @bamboocss/logger@1.0.1
  - @bamboocss/preset-bamboo@1.0.1
  - @bamboocss/shared@1.0.1
  - @bamboocss/types@1.0.1

## 1.0.0

### Major Changes

- a3bcbea: Stable release of BambooCSS

  ### Style Context

  Add `createStyleContext` function to framework artifacts for React, Preact, Solid, and Vue frameworks

  ```tsx
  import { sva } from 'styled-system/css'
  import { createStyleContext } from 'styled-system/jsx'

  const card = sva({
    slots: ['root', 'label'],
    base: {
      root: {
        color: 'red',
        bg: 'red.300',
      },
      label: {
        fontWeight: 'medium',
      },
    },
    variants: {
      size: {
        sm: {
          root: {
            padding: '10px',
          },
        },
        md: {
          root: {
            padding: '20px',
          },
        },
      },
    },
    defaultVariants: {
      size: 'sm',
    },
  })

  const { withProvider, withContext } = createStyleContext(card)

  const CardRoot = withProvider('div', 'root')
  const CardLabel = withContext('label', 'label')
  ```

  Then, use like this:

  ```tsx
  <CardRoot size="sm">
    <CardLabel>Hello</CardLabel>
  </CardRoot>
  ```

### Patch Changes

- Updated dependencies [860cc7d]
- Updated dependencies [a20811c]
- Updated dependencies [a3bcbea]
  - @bamboocss/preset-base@1.0.0
  - @bamboocss/logger@1.0.0
  - @bamboocss/preset-bamboo@1.0.0
  - @bamboocss/shared@1.0.0
  - @bamboocss/types@1.0.0

## 0.54.0

### Patch Changes

- Updated dependencies [efa060d]
- Updated dependencies [654ed5c]
- Updated dependencies [d2aede5]
  - @bamboocss/shared@0.54.0
  - @bamboocss/preset-base@0.54.0
  - @bamboocss/types@0.54.0
  - @bamboocss/logger@0.54.0
  - @bamboocss/preset-bamboo@0.54.0

## 0.53.7

### Patch Changes

- @bamboocss/logger@0.53.7
- @bamboocss/preset-base@0.53.7
- @bamboocss/preset-bamboo@0.53.7
- @bamboocss/shared@0.53.7
- @bamboocss/types@0.53.7

## 0.53.6

### Patch Changes

- @bamboocss/logger@0.53.6
- @bamboocss/preset-base@0.53.6
- @bamboocss/preset-bamboo@0.53.6
- @bamboocss/shared@0.53.6
- @bamboocss/types@0.53.6

## 0.53.5

### Patch Changes

- Updated dependencies [6fb83a8]
  - @bamboocss/preset-base@0.53.5
  - @bamboocss/logger@0.53.5
  - @bamboocss/preset-bamboo@0.53.5
  - @bamboocss/shared@0.53.5
  - @bamboocss/types@0.53.5

## 0.53.4

### Patch Changes

- @bamboocss/logger@0.53.4
- @bamboocss/preset-base@0.53.4
- @bamboocss/preset-bamboo@0.53.4
- @bamboocss/shared@0.53.4
- @bamboocss/types@0.53.4

## 0.53.3

### Patch Changes

- Updated dependencies [00aa868]
  - @bamboocss/preset-base@0.53.3
  - @bamboocss/logger@0.53.3
  - @bamboocss/preset-bamboo@0.53.3
  - @bamboocss/shared@0.53.3
  - @bamboocss/types@0.53.3

## 0.53.2

### Patch Changes

- cde9a0b: - Fix security issue due to stale version of `esbuild` used in `bundle-n-require`
- Updated dependencies [01d72ad]
  - @bamboocss/preset-base@0.53.2
  - @bamboocss/logger@0.53.2
  - @bamboocss/preset-bamboo@0.53.2
  - @bamboocss/shared@0.53.2
  - @bamboocss/types@0.53.2

## 0.53.1

### Patch Changes

- @bamboocss/logger@0.53.1
- @bamboocss/preset-base@0.53.1
- @bamboocss/preset-bamboo@0.53.1
- @bamboocss/shared@0.53.1
- @bamboocss/types@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [5286731]
  - @bamboocss/types@0.53.0
  - @bamboocss/logger@0.53.0
  - @bamboocss/preset-base@0.53.0
  - @bamboocss/preset-bamboo@0.53.0
  - @bamboocss/shared@0.53.0

## 0.52.0

### Patch Changes

- Updated dependencies [bb37d2b]
  - @bamboocss/preset-base@0.52.0
  - @bamboocss/logger@0.52.0
  - @bamboocss/preset-bamboo@0.52.0
  - @bamboocss/shared@0.52.0
  - @bamboocss/types@0.52.0

## 0.51.1

### Patch Changes

- @bamboocss/logger@0.51.1
- @bamboocss/preset-base@0.51.1
- @bamboocss/preset-bamboo@0.51.1
- @bamboocss/shared@0.51.1
- @bamboocss/types@0.51.1

## 0.51.0

### Minor Changes

- d68ad1f: **[BREAKING]**: Fix issue where Next.js build might fail intermittently due to version mismatch between
  internal `ts-morph` and userland `typescript`.

  > The current version of TS supported is `5.6.2`

### Patch Changes

- Updated dependencies [d68ad1f]
  - @bamboocss/types@0.51.0
  - @bamboocss/logger@0.51.0
  - @bamboocss/preset-base@0.51.0
  - @bamboocss/preset-bamboo@0.51.0
  - @bamboocss/shared@0.51.0

## 0.50.0

### Patch Changes

- Updated dependencies [fea78c7]
- Updated dependencies [ad89b90]
  - @bamboocss/types@0.50.0
  - @bamboocss/logger@0.50.0
  - @bamboocss/preset-base@0.50.0
  - @bamboocss/preset-bamboo@0.50.0
  - @bamboocss/shared@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [97a0e4d]
  - @bamboocss/preset-bamboo@0.49.0
  - @bamboocss/types@0.49.0
  - @bamboocss/logger@0.49.0
  - @bamboocss/preset-base@0.49.0
  - @bamboocss/shared@0.49.0

## 0.48.1

### Patch Changes

- Updated dependencies [af9715a]
  - @bamboocss/preset-base@0.48.1
  - @bamboocss/logger@0.48.1
  - @bamboocss/preset-bamboo@0.48.1
  - @bamboocss/shared@0.48.1
  - @bamboocss/types@0.48.1

## 0.48.0

### Patch Changes

- Updated dependencies [cff19aa]
  - @bamboocss/preset-base@0.48.0
  - @bamboocss/logger@0.48.0
  - @bamboocss/preset-bamboo@0.48.0
  - @bamboocss/shared@0.48.0
  - @bamboocss/types@0.48.0

## 0.47.1

### Patch Changes

- @bamboocss/logger@0.47.1
- @bamboocss/preset-base@0.47.1
- @bamboocss/preset-bamboo@0.47.1
- @bamboocss/shared@0.47.1
- @bamboocss/types@0.47.1

## 0.47.0

### Patch Changes

- Updated dependencies [5e683ee]
  - @bamboocss/types@0.47.0
  - @bamboocss/logger@0.47.0
  - @bamboocss/preset-base@0.47.0
  - @bamboocss/preset-bamboo@0.47.0
  - @bamboocss/shared@0.47.0

## 0.46.1

### Patch Changes

- @bamboocss/logger@0.46.1
- @bamboocss/preset-base@0.46.1
- @bamboocss/preset-bamboo@0.46.1
- @bamboocss/shared@0.46.1
- @bamboocss/types@0.46.1

## 0.46.0

### Patch Changes

- Updated dependencies [b7ed157]
- Updated dependencies [54426a2]
  - @bamboocss/preset-base@0.46.0
  - @bamboocss/shared@0.46.0
  - @bamboocss/types@0.46.0
  - @bamboocss/logger@0.46.0
  - @bamboocss/preset-bamboo@0.46.0

## 0.45.2

### Patch Changes

- @bamboocss/logger@0.45.2
- @bamboocss/preset-base@0.45.2
- @bamboocss/preset-bamboo@0.45.2
- @bamboocss/shared@0.45.2
- @bamboocss/types@0.45.2

## 0.45.1

### Patch Changes

- @bamboocss/logger@0.45.1
- @bamboocss/preset-base@0.45.1
- @bamboocss/preset-bamboo@0.45.1
- @bamboocss/shared@0.45.1
- @bamboocss/types@0.45.1

## 0.45.0

### Patch Changes

- Updated dependencies [dcc9053]
- Updated dependencies [552dd4b]
  - @bamboocss/types@0.45.0
  - @bamboocss/shared@0.45.0
  - @bamboocss/logger@0.45.0
  - @bamboocss/preset-base@0.45.0
  - @bamboocss/preset-bamboo@0.45.0

## 0.44.0

### Patch Changes

- d7f5cab: Ensure `globalFontface` definitions are merged correctly
- Updated dependencies [c99cb75]
  - @bamboocss/types@0.44.0
  - @bamboocss/logger@0.44.0
  - @bamboocss/preset-base@0.44.0
  - @bamboocss/preset-bamboo@0.44.0
  - @bamboocss/shared@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [e952f82]
  - @bamboocss/types@0.43.0
  - @bamboocss/logger@0.43.0
  - @bamboocss/preset-base@0.43.0
  - @bamboocss/preset-bamboo@0.43.0
  - @bamboocss/shared@0.43.0

## 0.42.0

### Minor Changes

- f00ff88: BREAKING: Remove `emitPackage` config option,

  tldr: use `importMap` instead for absolute paths (e.g can be used for component libraries)

  `emitPackage` is deprecated, it's known for causing several issues:
  - bundlers sometimes eagerly cache the `node_modules`, leading to `bamboo codegen` updates to the `styled-system` not
    visible in the browser
  - auto-imports are not suggested in your IDE.
  - in some IDE the typings are not always reflected properly

  As alternatives, you can use:
  - relative paths instead of absolute paths (e.g. `../styled-system/css` instead of `styled-system/css`)
  - use package.json #imports and/or tsconfig path aliases (prefer package.json#imports when possible, TS 5.4 supports
    them by default) like `#styled-system/css` instead of `styled-system/css`
    https://nodejs.org/api/packages.html#subpath-imports
  - for a component library, use a dedicated workspace package (e.g. `@acme/styled-system`) and use
    `importMap: "@acme/styled-system"` so that Bamboo knows which entrypoint to extract, e.g.
    `import { css } from '@acme/styled-system/css'` https://bamboocss.com/docs/guides/component-library

### Patch Changes

- Updated dependencies [e157dd1]
- Updated dependencies [19c3a2c]
- Updated dependencies [f00ff88]
- Updated dependencies [17a1932]
  - @bamboocss/preset-base@0.42.0
  - @bamboocss/preset-bamboo@0.42.0
  - @bamboocss/types@0.42.0
  - @bamboocss/logger@0.42.0
  - @bamboocss/shared@0.42.0

## 0.41.0

### Patch Changes

- @bamboocss/types@0.41.0
- @bamboocss/logger@0.41.0
- @bamboocss/preset-base@0.41.0
- @bamboocss/preset-bamboo@0.41.0
- @bamboocss/shared@0.41.0

## 0.40.1

### Patch Changes

- @bamboocss/logger@0.40.1
- @bamboocss/preset-base@0.40.1
- @bamboocss/preset-bamboo@0.40.1
- @bamboocss/shared@0.40.1
- @bamboocss/types@0.40.1

## 0.40.0

### Patch Changes

- @bamboocss/logger@0.40.0
- @bamboocss/preset-base@0.40.0
- @bamboocss/preset-bamboo@0.40.0
- @bamboocss/shared@0.40.0
- @bamboocss/types@0.40.0

## 0.39.2

### Patch Changes

- 2f63a4c: Fix issue where bamboo could load unrelated config files that look like a config e.g.
  `theming-bamboo.config.ts`
- Updated dependencies [1f636eb]
  - @bamboocss/shared@0.39.2
  - @bamboocss/types@0.39.2
  - @bamboocss/logger@0.39.2
  - @bamboocss/preset-base@0.39.2
  - @bamboocss/preset-bamboo@0.39.2

## 0.39.1

### Patch Changes

- @bamboocss/logger@0.39.1
- @bamboocss/preset-base@0.39.1
- @bamboocss/preset-bamboo@0.39.1
- @bamboocss/shared@0.39.1
- @bamboocss/types@0.39.1

## 0.39.0

### Patch Changes

- Updated dependencies [df2546a]
- Updated dependencies [221c9a2]
- Updated dependencies [2116abe]
- Updated dependencies [c3e797e]
- Updated dependencies [935ec86]
  - @bamboocss/preset-base@0.39.0
  - @bamboocss/types@0.39.0
  - @bamboocss/shared@0.39.0
  - @bamboocss/logger@0.39.0
  - @bamboocss/preset-bamboo@0.39.0

## 0.38.0

### Patch Changes

- Updated dependencies [96b47b3]
- Updated dependencies [bc09d89]
- Updated dependencies [2c8b933]
  - @bamboocss/types@0.38.0
  - @bamboocss/shared@0.38.0
  - @bamboocss/logger@0.38.0
  - @bamboocss/preset-base@0.38.0
  - @bamboocss/preset-bamboo@0.38.0

## 0.37.2

### Patch Changes

- Updated dependencies [74dfb3e]
  - @bamboocss/types@0.37.2
  - @bamboocss/logger@0.37.2
  - @bamboocss/preset-base@0.37.2
  - @bamboocss/preset-bamboo@0.37.2
  - @bamboocss/shared@0.37.2

## 0.37.1

### Patch Changes

- 88049c5: Improve token validation logic to parse references in `tokens` and compositve values like `borders` and
  `shadows` which could be objects.
- Updated dependencies [885963c]
- Updated dependencies [99870bb]
  - @bamboocss/types@0.37.1
  - @bamboocss/shared@0.37.1
  - @bamboocss/logger@0.37.1
  - @bamboocss/preset-base@0.37.1
  - @bamboocss/preset-bamboo@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [7daf159]
- Updated dependencies [bcfb5c5]
- Updated dependencies [6247dfb]
  - @bamboocss/shared@0.37.0
  - @bamboocss/preset-base@0.37.0
  - @bamboocss/types@0.37.0
  - @bamboocss/logger@0.37.0
  - @bamboocss/preset-bamboo@0.37.0

## 0.36.1

### Patch Changes

- Updated dependencies [bd0cb07]
  - @bamboocss/types@0.36.1
  - @bamboocss/logger@0.36.1
  - @bamboocss/preset-base@0.36.1
  - @bamboocss/preset-bamboo@0.36.1
  - @bamboocss/shared@0.36.1

## 0.36.0

### Minor Changes

- 2691f16: Add `config.themes` to easily define and apply a theme on multiple tokens at once, using data attributes and
  CSS variables.

  Can pre-generate multiple themes with token overrides as static CSS, but also dynamically import and inject a theme
  stylesheet at runtime (browser or server).

  Example:

  ```ts
  // bamboo.config.ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    // main theme
    theme: {
      extend: {
        tokens: {
          colors: {
            text: { value: 'blue' },
          },
        },
        semanticTokens: {
          colors: {
            body: {
              value: {
                base: '{colors.blue.600}',
                _osDark: '{colors.blue.400}',
              },
            },
          },
        },
      },
    },
    // alternative theme variants
    themes: {
      primary: {
        tokens: {
          colors: {
            text: { value: 'red' },
          },
        },
        semanticTokens: {
          colors: {
            muted: { value: '{colors.red.200}' },
            body: {
              value: {
                base: '{colors.red.600}',
                _osDark: '{colors.red.400}',
              },
            },
          },
        },
      },
      secondary: {
        tokens: {
          colors: {
            text: { value: 'blue' },
          },
        },
        semanticTokens: {
          colors: {
            muted: { value: '{colors.blue.200}' },
            body: {
              value: {
                base: '{colors.blue.600}',
                _osDark: '{colors.blue.400}',
              },
            },
          },
        },
      },
    },
  })
  ```

  ### Pregenerating themes

  By default, no additional theme variant is generated, you need to specify the specific themes you want to generate in
  `staticCss.themes` to include them in the CSS output.

  ```ts
  // bamboo.config.ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    staticCss: {
      themes: ['primary', 'secondary'],
    },
  })
  ```

  This will generate the following CSS:

  ```css
  @layer tokens {
    :where(:root, :host) {
      --colors-text: blue;
      --colors-body: var(--colors-blue-600);
    }

    [data-bamboo-theme='primary'] {
      --colors-text: red;
      --colors-muted: var(--colors-red-200);
      --colors-body: var(--colors-red-600);
    }

    @media (prefers-color-scheme: dark) {
      :where(:root, :host) {
        --colors-body: var(--colors-blue-400);
      }

      [data-bamboo-theme='primary'] {
        --colors-body: var(--colors-red-400);
      }
    }
  }
  ```

  ***

  An alternative way of applying a theme is by using the new `styled-system/themes` entrypoint where you can import the
  themes CSS variables and use them in your app.

  > ℹ️ The `styled-system/themes` will always contain every themes (tree-shaken if not used), `staticCss.themes` only
  > applies to the CSS output.

  Each theme has a corresponding JSON file with a similar structure:

  ```json
  {
    "name": "primary",
    "id": "bamboo-themes-primary",
    "dataAttr": "primary",
    "css": "[data-bamboo-theme=primary] { ... }"
  }
  ```

  > ℹ️ Note that for semantic tokens, you need to use inject the theme styles, see below

  Dynamically import a theme using its name:

  ```ts
  import { getTheme } from '../styled-system/themes'

  const theme = await getTheme('red')
  //    ^? {
  //     name: "red";
  //     id: string;
  //     css: string;
  // }
  ```

  Inject the theme styles into the DOM:

  ```ts
  import { injectTheme } from '../styled-system/themes'

  const theme = await getTheme('red')
  injectTheme(document.documentElement, theme) // this returns the injected style element
  ```

  ***

  SSR example with NextJS:

  ```tsx
  // app/layout.tsx
  import { Inter } from 'next/font/google'
  import { cookies } from 'next/headers'
  import { ThemeName, getTheme } from '../../styled-system/themes'

  export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const store = cookies()
    const themeName = store.get('theme')?.value as ThemeName
    const theme = themeName && (await getTheme(themeName))

    return (
      <html lang="en" data-bamboo-theme={themeName ? themeName : undefined}>
        {themeName && (
          <head>
            <style type="text/css" id={theme.id} dangerouslySetInnerHTML={{ __html: theme.css }} />
          </head>
        )}
        <body>{children}</body>
      </html>
    )
  }

  // app/page.tsx
  import { getTheme, injectTheme } from '../../styled-system/themes'

  export default function Home() {
    return (
      <>
        <button
          onClick={async () => {
            const current = document.documentElement.dataset.bambooTheme
            const next = current === 'primary' ? 'secondary' : 'primary'
            const theme = await getTheme(next)
            setCookie('theme', next, 7)
            injectTheme(document.documentElement, theme)
          }}
        >
          swap theme
        </button>
      </>
    )
  }

  // Set a Cookie
  function setCookie(cName: string, cValue: any, expDays: number) {
    let date = new Date()
    date.setTime(date.getTime() + expDays * 24 * 60 * 60 * 1000)
    const expires = 'expires=' + date.toUTCString()
    document.cookie = cName + '=' + cValue + '; ' + expires + '; path=/'
  }
  ```

  ***

  Finally, you can create a theme contract to ensure that all themes have the same structure:

  ```ts
  import { defineThemeContract } from '@bamboocss/dev'

  const defineTheme = defineThemeContract({
    tokens: {
      colors: {
        red: { value: '' }, // theme implementations must have a red color
      },
    },
  })

  defineTheme({
    selector: '.theme-secondary',
    tokens: {
      colors: {
        // ^^^^   Property 'red' is missing in type '{}' but required in type '{ red: { value: string; }; }'
        //
        // fixed with
        // red: { value: 'red' },
      },
    },
  })
  ```

### Patch Changes

- 445c7b6: Fix merging issue when using a preset that has a token with a conflicting value with another (or the user's
  config)

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  const userConfig = defineConfig({
    presets: [
      {
        theme: {
          extend: {
            tokens: {
              colors: {
                black: { value: 'black' },
              },
            },
          },
        },
      },
    ],
    theme: {
      tokens: {
        extend: {
          colors: {
            black: {
              0: { value: 'black' },
              10: { value: 'black/10' },
              20: { value: 'black/20' },
              30: { value: 'black/30' },
            },
          },
        },
      },
    },
  })
  ```

  When merged with the preset, the config would create nested tokens (`black.10`, `black.20`, `black.30`) inside of the
  initially flat `black` token.

  This would cause issues as the token engine stops diving deeper after encountering an object with a `value` property.

  To fix this, we now automatically replace the flat `black` token using the `DEFAULT` keyword when resolving the config
  so that the token engine can continue to dive deeper into the object:

  ```diff
  {
    "theme": {
      "tokens": {
        "colors": {
          "black": {
            "0": {
              "value": "black",
            },
            "10": {
              "value": "black/10",
            },
            "20": {
              "value": "black/20",
            },
            "30": {
              "value": "black/30",
            },
  -          "value": "black",
  +          "DEFAULT": {
  +            "value": "black",
  +          },
          },
        },
      },
    },
  }
  ```

- 861a280: Introduce a new `globalVars` config option to define type-safe
  [CSS variables](https://developer.mozilla.org/en-US/docs/Web/CSS/--*) and custom
  [CSS @property](https://developer.mozilla.org/en-US/docs/Web/CSS/@property).

  Example:

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    globalVars: {
      '--some-color': 'red',
      '--button-color': {
        syntax: '<color>',
        inherits: false,
        initialValue: 'blue',
      },
    },
  })
  ```

  > Note: Keys defined in `globalVars` will be available as a value for _every_ utilities, as they're not bound to token
  > categories.

  ```ts
  import { css } from '../styled-system/css'

  const className = css({
    '--button-color': 'colors.red.300',
    // ^^^^^^^^^^^^  will be suggested

    backgroundColor: 'var(--button-color)',
    //                ^^^^^^^^^^^^^^^^^^  will be suggested
  })
  ```

- Updated dependencies [861a280]
- Updated dependencies [2691f16]
- Updated dependencies [340f4f1]
- Updated dependencies [fabdabe]
  - @bamboocss/types@0.36.0
  - @bamboocss/logger@0.36.0
  - @bamboocss/preset-base@0.36.0
  - @bamboocss/preset-bamboo@0.36.0
  - @bamboocss/shared@0.36.0

## 0.35.0

### Patch Changes

- 50db354: Add missing reducers to properly return the results of hooks for `config:resolved` and `parser:before`
- Updated dependencies [50db354]
- Updated dependencies [f6befbf]
- Updated dependencies [a0c4d27]
  - @bamboocss/types@0.35.0
  - @bamboocss/logger@0.35.0
  - @bamboocss/preset-base@0.35.0
  - @bamboocss/preset-bamboo@0.35.0
  - @bamboocss/shared@0.35.0

## 0.34.3

### Patch Changes

- @bamboocss/logger@0.34.3
- @bamboocss/preset-base@0.34.3
- @bamboocss/preset-bamboo@0.34.3
- @bamboocss/shared@0.34.3
- @bamboocss/types@0.34.3

## 0.34.2

### Patch Changes

- 58388de: Fix a false positive with the validation check that reported `Missing token` when using a color opacity
  modifier in config `tokens` or `semanticTokens`

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    validation: 'warn',
    conditions: {
      light: '.light &',
      dark: '.dark &',
    },
    theme: {
      tokens: {
        colors: {
          blue: { 500: { value: 'blue' } },
          green: { 500: { value: 'green' } },
        },
        opacity: {
          half: { value: 0.5 },
        },
      },
      semanticTokens: {
        colors: {
          secondary: {
            value: {
              base: 'red',
              _light: '{colors.blue.500/32}',
              _dark: '{colors.green.500/half}',
            },
          },
        },
      },
    },
  })
  ```

  Would incorrectly report:
  - [tokens] Missing token: `colors.green.500/half` used in `config.semanticTokens.colors.secondary`
  - [tokens] Missing token: `colors.blue.500/32` used in `config.semanticTokens.colors.secondary`
  - @bamboocss/types@0.34.2
  - @bamboocss/logger@0.34.2
  - @bamboocss/preset-base@0.34.2
  - @bamboocss/preset-bamboo@0.34.2
  - @bamboocss/shared@0.34.2

## 0.34.1

### Patch Changes

- @bamboocss/logger@0.34.1
- @bamboocss/preset-base@0.34.1
- @bamboocss/preset-bamboo@0.34.1
- @bamboocss/shared@0.34.1
- @bamboocss/types@0.34.1

## 0.34.0

### Patch Changes

- 1c63216: Add a config validation check to prevent using spaces in token keys, show better error logs when there's a
  CSS parsing error
- 9f04427: Fix "missing token" warning when using DEFAULT in tokens path

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    validation: 'error',
    theme: {
      semanticTokens: {
        colors: {
          primary: {
            DEFAULT: { value: '#ff3333' },
            lighter: { value: '#ff6666' },
          },
          background: { value: '{colors.primary}' }, // <-- ⚠️ wrong warning
          background2: { value: '{colors.primary.lighter}' }, // <-- no warning, correct
        },
      },
    },
  })
  ```

  ***

  Add a warning when using `value` twice

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    validation: 'error',
    theme: {
      tokens: {
        colors: {
          primary: { value: '#ff3333' },
        },
      },
      semanticTokens: {
        colors: {
          primary: {
            value: { value: '{colors.primary}' }, // <-- ⚠️ new warning for this
          },
        },
      },
    },
  })
  ```

- Updated dependencies [d1516c8]
  - @bamboocss/types@0.34.0
  - @bamboocss/logger@0.34.0
  - @bamboocss/preset-base@0.34.0
  - @bamboocss/preset-bamboo@0.34.0
  - @bamboocss/shared@0.34.0

## 0.33.0

### Patch Changes

- 8feeb95: Add `definePlugin` config functions for type-safety around plugins, add missing `plugins` in config
  dependencies to trigger a config reload on `plugins` change
- Updated dependencies [cca50d5]
- Updated dependencies [fde37d8]
  - @bamboocss/preset-base@0.33.0
  - @bamboocss/types@0.33.0
  - @bamboocss/logger@0.33.0
  - @bamboocss/preset-bamboo@0.33.0
  - @bamboocss/shared@0.33.0

## 0.32.1

### Patch Changes

- a032375: Add a way to create config conditions with nested at-rules/selectors

  ```ts
  export default defaultConfig({
    conditions: {
      extend: {
        supportHover: ['@media (hover: hover) and (pointer: fine)', '&:hover'],
      },
    },
  })
  ```

  ```ts
  import { css } from '../styled-system/css'

  css({
    _supportHover: {
      color: 'red',
    },
  })
  ```

  will generate the following CSS:

  ```css
  @media (hover: hover) and (pointer: fine) {
    &:hover {
      color: red;
    }
  }
  ```

- 89ffb6b: Add missing config dependencies for some `styled-system/types` files
- Updated dependencies [a032375]
- Updated dependencies [89ffb6b]
  - @bamboocss/types@0.32.1
  - @bamboocss/logger@0.32.1
  - @bamboocss/preset-base@0.32.1
  - @bamboocss/preset-bamboo@0.32.1
  - @bamboocss/shared@0.32.1

## 0.32.0

### Minor Changes

- de4d9ef: Allow `config.hooks` to be shared in `plugins`

  For hooks that can transform Bamboo's internal state by returning something (like `cssgen:done` and
  `codegen:prepare`), each hook instance will be called sequentially and the return result (if any) of the previous hook
  call is passed to the next hook so that they can be chained together.

### Patch Changes

- Updated dependencies [8cd8c19]
- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
  - @bamboocss/shared@0.32.0
  - @bamboocss/types@0.32.0
  - @bamboocss/logger@0.32.0
  - @bamboocss/preset-base@0.32.0
  - @bamboocss/preset-bamboo@0.32.0

## 0.31.0

### Minor Changes

- f0296249: - Sort the longhand/shorthand atomic rules in a deterministic order to prevent property conflicts
  - Automatically merge the `base` object in the `css` root styles in the runtime
  - This may be a breaking change depending on how your styles are created

  Ex:

  ```ts
  css({
    padding: '1px',
    paddingTop: '3px',
    paddingBottom: '4px',
  })
  ```

  Will now always generate the following css:

  ```css
  @layer utilities {
    .p_1px {
      padding: 1px;
    }

    .pt_3px {
      padding-top: 3px;
    }

    .pb_4px {
      padding-bottom: 4px;
    }
  }
  ```

### Patch Changes

- e2ad0eed: - Fix issue in token validation logic where token with additional properties like `description` is
  considered invalid.
  - When `validation` is set to `error`, show all config errors at once instead of stopping at the first error.
- 2d69b340: Fix `styled` factory nested composition with `cva`
- ddeda8ac: Add missing log with the `bamboo -w` CLI, expose `resolveConfig` from `@bamboocss/config`
- Updated dependencies [8f36f9af]
- Updated dependencies [f0296249]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
- Updated dependencies [40cb30b9]
  - @bamboocss/types@0.31.0
  - @bamboocss/shared@0.31.0
  - @bamboocss/preset-base@0.31.0
  - @bamboocss/logger@0.31.0
  - @bamboocss/preset-bamboo@0.31.0

## 0.30.2

### Patch Changes

- Updated dependencies [6b829cab]
  - @bamboocss/types@0.30.2
  - @bamboocss/logger@0.30.2
  - @bamboocss/preset-base@0.30.2
  - @bamboocss/preset-bamboo@0.30.2
  - @bamboocss/shared@0.30.2

## 0.30.1

### Patch Changes

- ffe177fd: Fix the regression caused by the downstream bundle-n-require package, which tries to load custom conditions
  first. This led to a `could not resolve @bamboocss/dev` error
  - @bamboocss/logger@0.30.1
  - @bamboocss/preset-base@0.30.1
  - @bamboocss/preset-bamboo@0.30.1
  - @bamboocss/shared@0.30.1
  - @bamboocss/types@0.30.1

## 0.30.0

### Minor Changes

- 0dd45b6a: Fix issue where config changes could not be detected due to config bundling returning stale result
  sometimes.

### Patch Changes

- 74485ef1: Add `utils` functions in the `config:resolved` hook, making it easy to apply transformations after all
  presets have been merged.

  For example, this could be used if you want to use most of a preset but want to completely omit a few things, while
  keeping the rest. Let's say we want to remove the `stack` pattern from the built-in `@bamboocss/preset-base`:

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    hooks: {
      'config:resolved': ({ config, utils }) => {
        return utils.omit(config, ['patterns.stack'])
      },
    },
  })
  ```

- ab32d1d7: Fix issue where errors were thrown when semantic tokens are overriden in tokens.
- d5977c24: - Add a `--logfile` flag to the `bamboo`, `bamboo codegen`, `bamboo cssgen` and `bamboo debug` commands.
  - Add a `logfile` option to the postcss plugin

  Logs will be streamed to the file specified by the `--logfile` flag or the `logfile` option. This is useful for
  debugging issues that occur during the build process.

  ```sh
  bamboo --logfile ./logs/bamboo.log
  ```

  ```js
  module.exports = {
    plugins: {
      '@bamboocss/dev/postcss': {
        logfile: './logs/bamboo.log',
      },
    },
  }
  ```

- Updated dependencies [74485ef1]
- Updated dependencies [ab32d1d7]
- Updated dependencies [49c760cd]
- Updated dependencies [d5977c24]
  - @bamboocss/types@0.30.0
  - @bamboocss/shared@0.30.0
  - @bamboocss/logger@0.30.0
  - @bamboocss/preset-base@0.30.0
  - @bamboocss/preset-bamboo@0.30.0

## 0.29.1

### Patch Changes

- @bamboocss/logger@0.29.1
- @bamboocss/preset-base@0.29.1
- @bamboocss/preset-bamboo@0.29.1
- @bamboocss/shared@0.29.1
- @bamboocss/types@0.29.1

## 0.29.0

### Minor Changes

- a2fb5cc6: - Add support for explicitly specifying config related files that should trigger a context reload on change.

  > We automatically track the config file and (transitive) files imported by the config file as much as possible, but
  > sometimes we might miss some. You can use this option as a workaround for those edge cases.

  Set the `dependencies` option in `bamboo.config.ts` to a glob or list of files.

  ```ts
  export default defineConfig({
    // ...
    dependencies: ['path/to/files/**.ts'],
  })
  ```

  - Invoke `config:change` hook in more situations (when the `--watch` flag is passed to `bamboo codegen`,
    `bamboo cssgen`, `bamboo ship`)

  - Watch for more config options paths changes, so that the related artifacts will be regenerated a bit more reliably
    (ex: updating the `config.hooks` will now trigger a full regeneration of `styled-system`)

### Patch Changes

- ea3f5548: Add config validation:
  - Check for duplicate between token & semanticTokens names
  - Check for duplicate between recipes/patterns/slots names
  - Check for token / semanticTokens paths (must end/contain 'value')
  - Check for self/circular token references
  - Check for missing tokens references
  - Check for conditions selectors (must contain '&')
  - Check for breakpoints units (must be the same)

  > You can set `validate: 'warn'` in your config to only warn about errors or set it to `none` to disable validation
  > entirely.

- Updated dependencies [5fcdeb75]
- Updated dependencies [250b4d11]
- Updated dependencies [f778d3e5]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/preset-base@0.29.0
  - @bamboocss/types@0.29.0
  - @bamboocss/preset-bamboo@0.29.0
  - @bamboocss/logger@0.29.0
  - @bamboocss/shared@0.29.0

## 0.28.0

### Minor Changes

- f58f6df2: Refactor `config.hooks` to be much more powerful, you can now:
  - Tweak the config after it has been resolved (after presets are loaded and merged), this could be used to dynamically
    load all `recipes` from a folder
  - Transform a source file's content before parsing it, this could be used to transform the file content to a
    `tsx`-friendly syntax so that Bamboo's parser can parse it.
  - Implement your own parser logic and add the extracted results to the classic Bamboo pipeline, this could be used to
    parse style usage from any template language
  - Tweak the CSS content for any `@layer` or even right before it's written to disk (if using the CLI) or injected
    through the postcss plugin, allowing all kinds of customizations like removing the unused CSS variables, etc.
  - React to any config change or after the codegen step (your outdir, the `styled-system` folder) have been generated

  See the list of available `config.hooks` here:

  ```ts
  export interface BambooHooks {
    /**
     * Called when the config is resolved, after all the presets are loaded and merged.
     * This is the first hook called, you can use it to tweak the config before the context is created.
     */
    'config:resolved': (args: { conf: LoadConfigResult }) => MaybeAsyncReturn
    /**
     * Called when the Bamboo context has been created and the API is ready to be used.
     */
    'context:created': (args: { ctx: ApiInterface; logger: LoggerInterface }) => void
    /**
     * Called when the config file or one of its dependencies (imports) has changed.
     */
    'config:change': (args: { config: UserConfig }) => MaybeAsyncReturn
    /**
     * Called after reading the file content but before parsing it.
     * You can use this hook to transform the file content to a tsx-friendly syntax so that Bamboo's parser can parse it.
     * You can also use this hook to parse the file's content on your side using a custom parser, in this case you don't have to return anything.
     */
    'parser:before': (args: { filePath: string; content: string }) => string | void
    /**
     * Called after the file styles are extracted and processed into the resulting ParserResult object.
     * You can also use this hook to add your own extraction results from your custom parser to the ParserResult object.
     */
    'parser:after': (args: { filePath: string; result: ParserResultInterface | undefined }) => void
    /**
     * Called after the codegen is completed
     */
    'codegen:done': () => MaybeAsyncReturn
    /**
     * Called right before adding the design-system CSS (global, static, preflight, tokens, keyframes) to the final CSS
     * Called right before writing/injecting the final CSS (styles.css) that contains the design-system CSS and the parser CSS
     * You can use it to tweak the CSS content before it's written to disk or injected through the postcss plugin.
     */
    'cssgen:done': (args: {
      artifact: 'global' | 'static' | 'reset' | 'tokens' | 'keyframes' | 'styles.css'
      content: string
    }) => string | void
  }
  ```

### Patch Changes

- Updated dependencies [f58f6df2]
- Updated dependencies [770c7aa4]
  - @bamboocss/types@0.28.0
  - @bamboocss/shared@0.28.0
  - @bamboocss/preset-base@0.28.0
  - @bamboocss/preset-bamboo@0.28.0
  - @bamboocss/error@0.28.0
  - @bamboocss/logger@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/preset-base@0.27.3
  - @bamboocss/preset-bamboo@0.27.3
  - @bamboocss/error@0.27.3
  - @bamboocss/logger@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/error@0.27.2
- @bamboocss/logger@0.27.2
- @bamboocss/preset-base@0.27.2
- @bamboocss/preset-bamboo@0.27.2
- @bamboocss/shared@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
  - @bamboocss/preset-base@0.27.1
  - @bamboocss/preset-bamboo@0.27.1
  - @bamboocss/error@0.27.1
  - @bamboocss/logger@0.27.1
  - @bamboocss/shared@0.27.1

## 0.27.0

### Minor Changes

- 84304901: Improve performance, mostly for the CSS generation by removing a lot of `postcss` usage (and plugins).

  ## Public changes:
  - Introduce a new `config.lightningcss` option to use `lightningcss` (currently disabled by default) instead of
    `postcss`.
  - Add a new `config.browserslist` option to configure the browserslist used by `lightningcss`.
  - Add a `--lightningcss` flag to the `bamboo` and `bamboo cssgen` command to use `lightningcss` instead of `postcss`
    for this run.

  ## Internal changes:
  - `markImportant` fn from JS instead of walking through postcss AST nodes
  - use a fork of `stitches` `stringify` function instead of `postcss-css-in-js` to write the CSS string from a JS
    object
  - only compute once `TokenDictionary` properties
  - refactor `serializeStyle` to use the same code path as the rest of the pipeline with `StyleEncoder` / `StyleDecoder`
    and rename it to `transformStyles` to better convey what it does

### Patch Changes

- c9195a4e: ## Change

  Change the config dependencies (files that are transitively imported) detection a bit more permissive to make it work
  by default in more scenarios.

  ## Context

  This helps when you're in a monorepo and you have a workspace package for your preset, and you want to see the HMR
  reflecting changes in your app.

  Currently, we only traverse files with the `.ts` extension, this change makes it traverse all files ending with `.ts`,
  meaning that it will also traverse `.d.ts`, `.d.mts`, `.mts`, etc.

  ## Example

  ```ts
  // apps/storybook/bamboo.config.ts
  import { defineConfig } from '@bamboocss/dev'
  import preset from '@acme/preset'

  export default defineConfig({
    // ...
  })
  ```

  This would not work before, but now it does.

  ```jsonc
  {
    "name": "@acme/preset",
    "types": "./dist/index.d.mts", // we only looked into `.ts` files, so we didnt check this
    "main": "./dist/index.js",
    "module": "./dist/index.mjs",
  }
  ```

  ## Notes

  This would have been fine before that change.

  ```jsonc
  // packages/preset/package.json
  {
    "name": "@acme/preset",
    "types": "./src/index.ts", // this was fine
    "main": "./dist/index.js",
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.mjs",
        "require": "./dist/index.js",
      },
      // ...
    },
  }
  ```

- Updated dependencies [84304901]
- Updated dependencies [bee3ec85]
- Updated dependencies [74ac0d9d]
  - @bamboocss/preset-bamboo@0.27.0
  - @bamboocss/preset-base@0.27.0
  - @bamboocss/logger@0.27.0
  - @bamboocss/shared@0.27.0
  - @bamboocss/error@0.27.0
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- Updated dependencies [f823a8c5]
  - @bamboocss/preset-base@0.26.2
  - @bamboocss/error@0.26.2
  - @bamboocss/logger@0.26.2
  - @bamboocss/preset-bamboo@0.26.2
  - @bamboocss/shared@0.26.2
  - @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/error@0.26.1
- @bamboocss/logger@0.26.1
- @bamboocss/preset-base@0.26.1
- @bamboocss/preset-bamboo@0.26.1
- @bamboocss/shared@0.26.1
- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- 1bd7fbb7: Fix an edge-case for when the `config.outdir` would not be set in the `bamboo.config`

  Internal details: The `outdir` would not have any value after a config change due to the fallback being set in the
  initial config resolving code path but not in context reloading code path, moving it inside the config loading
  function fixes this issue.

- Updated dependencies [3f6b3662]
- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/preset-base@0.26.0
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0
  - @bamboocss/preset-bamboo@0.26.0
  - @bamboocss/error@0.26.0
  - @bamboocss/logger@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [59fd291c]
  - @bamboocss/types@0.25.0
  - @bamboocss/preset-base@0.25.0
  - @bamboocss/preset-bamboo@0.25.0
  - @bamboocss/error@0.25.0
  - @bamboocss/logger@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2
  - @bamboocss/preset-base@0.24.2
  - @bamboocss/preset-bamboo@0.24.2
  - @bamboocss/error@0.24.2
  - @bamboocss/logger@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/error@0.24.1
- @bamboocss/logger@0.24.1
- @bamboocss/preset-base@0.24.1
- @bamboocss/preset-bamboo@0.24.1
- @bamboocss/shared@0.24.1
- @bamboocss/types@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [f6881022]
  - @bamboocss/types@0.24.0
  - @bamboocss/preset-base@0.24.0
  - @bamboocss/preset-bamboo@0.24.0
  - @bamboocss/error@0.24.0
  - @bamboocss/logger@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- Updated dependencies [bd552b1f]
  - @bamboocss/logger@0.23.0
  - @bamboocss/error@0.23.0
  - @bamboocss/preset-base@0.23.0
  - @bamboocss/preset-bamboo@0.23.0
  - @bamboocss/shared@0.23.0
  - @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
  - @bamboocss/types@0.22.1
  - @bamboocss/shared@0.22.1
  - @bamboocss/preset-base@0.22.1
  - @bamboocss/preset-bamboo@0.22.1
  - @bamboocss/error@0.22.1
  - @bamboocss/logger@0.22.1

## 0.22.0

### Patch Changes

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
- Updated dependencies [1cc8fcff]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0
  - @bamboocss/preset-base@0.22.0
  - @bamboocss/preset-bamboo@0.22.0
  - @bamboocss/error@0.22.0
  - @bamboocss/logger@0.22.0

## 0.21.0

### Patch Changes

- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0
  - @bamboocss/preset-base@0.21.0
  - @bamboocss/preset-bamboo@0.21.0
  - @bamboocss/error@0.21.0
  - @bamboocss/logger@0.21.0

## 0.20.1

### Patch Changes

- Updated dependencies [428e5401]
  - @bamboocss/preset-base@0.20.1
  - @bamboocss/error@0.20.1
  - @bamboocss/logger@0.20.1
  - @bamboocss/preset-bamboo@0.20.1
  - @bamboocss/shared@0.20.1
  - @bamboocss/types@0.20.1

## 0.20.0

### Minor Changes

- 904aec7b: - Add support for `staticCss` in presets allowing you create sharable, pre-generated styles
  - Add support for extending `staticCss` defined in presets

  ```jsx
  const presetWithStaticCss = definePreset({
    staticCss: {
      recipes: {
        // generate all button styles and variants
        button: ['*'],
      },
    },
  })

  export default defineConfig({
    presets: [presetWithStaticCss],
    staticCss: {
      extend: {
        recipes: {
          // extend and pre-generate all sizes for card
          card: [{ size: ['small', 'medium', 'large'] }],
        },
      },
    },
  })
  ```

### Patch Changes

- 24ee49a5: - Add support for granular config change detection
  - Improve the `codegen` experience by only rewriting files affecteds by a config change
- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/preset-base@0.20.0
  - @bamboocss/preset-bamboo@0.20.0
  - @bamboocss/error@0.20.0
  - @bamboocss/logger@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0
  - @bamboocss/preset-base@0.19.0
  - @bamboocss/preset-bamboo@0.19.0
  - @bamboocss/error@0.19.0
  - @bamboocss/logger@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/error@0.18.3
- @bamboocss/logger@0.18.3
- @bamboocss/preset-base@0.18.3
- @bamboocss/preset-bamboo@0.18.3
- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- Updated dependencies [3e1ea626]
  - @bamboocss/preset-base@0.18.2
  - @bamboocss/error@0.18.2
  - @bamboocss/logger@0.18.2
  - @bamboocss/preset-bamboo@0.18.2
  - @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- Updated dependencies [ce34ea45]
- Updated dependencies [aac7b379]
  - @bamboocss/preset-base@0.18.1
  - @bamboocss/error@0.18.1
  - @bamboocss/logger@0.18.1
  - @bamboocss/preset-bamboo@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- @bamboocss/types@0.18.0
- @bamboocss/error@0.18.0
- @bamboocss/logger@0.18.0
- @bamboocss/preset-base@0.18.0
- @bamboocss/preset-bamboo@0.18.0

## 0.17.5

### Patch Changes

- @bamboocss/error@0.17.5
- @bamboocss/logger@0.17.5
- @bamboocss/preset-base@0.17.5
- @bamboocss/preset-bamboo@0.17.5
- @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/preset-base@0.17.4
  - @bamboocss/preset-bamboo@0.17.4
  - @bamboocss/error@0.17.4
  - @bamboocss/logger@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/preset-base@0.17.3
  - @bamboocss/preset-bamboo@0.17.3
  - @bamboocss/error@0.17.3
  - @bamboocss/logger@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/error@0.17.2
- @bamboocss/logger@0.17.2
- @bamboocss/preset-base@0.17.2
- @bamboocss/preset-bamboo@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- @bamboocss/types@0.17.1
- @bamboocss/error@0.17.1
- @bamboocss/logger@0.17.1
- @bamboocss/preset-base@0.17.1
- @bamboocss/preset-bamboo@0.17.1

## 0.17.0

### Patch Changes

- Updated dependencies [fc4688e6]
  - @bamboocss/types@0.17.0
  - @bamboocss/preset-base@0.17.0
  - @bamboocss/preset-bamboo@0.17.0
  - @bamboocss/error@0.17.0
  - @bamboocss/logger@0.17.0

## 0.16.0

### Patch Changes

- Updated dependencies [0f3bede5]
  - @bamboocss/preset-base@0.16.0
  - @bamboocss/error@0.16.0
  - @bamboocss/logger@0.16.0
  - @bamboocss/preset-bamboo@0.16.0
  - @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/error@0.15.5
- @bamboocss/logger@0.15.5
- @bamboocss/preset-base@0.15.5
- @bamboocss/preset-bamboo@0.15.5
- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- abd7c47a: Fix preset merging, config wins over presets.
  - @bamboocss/types@0.15.4
  - @bamboocss/error@0.15.4
  - @bamboocss/logger@0.15.4
  - @bamboocss/preset-base@0.15.4
  - @bamboocss/preset-bamboo@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/types@0.15.3
  - @bamboocss/preset-base@0.15.3
  - @bamboocss/preset-bamboo@0.15.3
  - @bamboocss/error@0.15.3
  - @bamboocss/logger@0.15.3

## 0.15.2

### Patch Changes

- 2645c2da: > Note: This is only relevant for users using more than 1 custom defined preset that overlap with each
  other.

  BREAKING CHANGE: Presets merging order felt wrong (left overriding right presets) and is now more intuitive (right
  overriding left presets)

  Example:

  ```ts
  const firstConfig = definePreset({
    theme: {
      tokens: {
        colors: {
          'first-main': { value: 'override' },
        },
      },
      extend: {
        tokens: {
          colors: {
            orange: { value: 'orange' },
            gray: { value: 'from-first-config' },
          },
        },
      },
    },
  })

  const secondConfig = definePreset({
    theme: {
      tokens: {
        colors: {
          pink: { value: 'pink' },
        },
      },
      extend: {
        tokens: {
          colors: {
            blue: { value: 'blue' },
            gray: { value: 'gray' },
          },
        },
      },
    },
  })

  // Final config
  export default defineConfig({
    presets: [firstConfig, secondConfig],
  })
  ```

  Here's the difference between the old and new behavior:

  ```diff
  {
    "theme": {
      "tokens": {
        "colors": {
          "blue": {
            "value": "blue"
          },
  -        "first-main": {
  -          "value": "override"
  -        },
          "gray": {
  -          "value": "from-first-config"
  +          "value": "gray"
          },
          "orange": {
            "value": "orange"
          },
  +        "pink": {
  +            "value": "pink",
  +        },
        }
      }
    }
  }
  ```

- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/preset-base@0.15.2
  - @bamboocss/preset-bamboo@0.15.2
  - @bamboocss/error@0.15.2
  - @bamboocss/logger@0.15.2

## 0.15.1

### Patch Changes

- @bamboocss/types@0.15.1
- @bamboocss/error@0.15.1
- @bamboocss/logger@0.15.1
- @bamboocss/preset-base@0.15.1
- @bamboocss/preset-bamboo@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies [4bc515ea]
- Updated dependencies [39298609]
  - @bamboocss/types@0.15.0
  - @bamboocss/preset-base@0.15.0
  - @bamboocss/preset-bamboo@0.15.0
  - @bamboocss/error@0.15.0
  - @bamboocss/logger@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [8106b411]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/types@0.14.0
  - @bamboocss/preset-base@0.14.0
  - @bamboocss/preset-bamboo@0.14.0
  - @bamboocss/error@0.14.0
  - @bamboocss/logger@0.14.0

## 0.13.1

### Patch Changes

- d0fbc7cc: Allow `.mts` and `.cts` bamboo config extension
- Updated dependencies [d0fbc7cc]
  - @bamboocss/error@0.13.1
  - @bamboocss/logger@0.13.1
  - @bamboocss/preset-base@0.13.1
  - @bamboocss/preset-bamboo@0.13.1
  - @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- @bamboocss/error@0.13.0
- @bamboocss/logger@0.13.0
- @bamboocss/preset-base@0.13.0
- @bamboocss/preset-bamboo@0.13.0
- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/error@0.12.2
- @bamboocss/logger@0.12.2
- @bamboocss/preset-base@0.12.2
- @bamboocss/preset-bamboo@0.12.2
- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/error@0.12.1
- @bamboocss/logger@0.12.1
- @bamboocss/preset-base@0.12.1
- @bamboocss/preset-bamboo@0.12.1
- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- Updated dependencies [bf2ff391]
  - @bamboocss/preset-base@0.12.0
  - @bamboocss/error@0.12.0
  - @bamboocss/logger@0.12.0
  - @bamboocss/preset-bamboo@0.12.0
  - @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- Updated dependencies [23b516f4]
  - @bamboocss/types@0.11.1
  - @bamboocss/preset-base@0.11.1
  - @bamboocss/preset-bamboo@0.11.1
  - @bamboocss/error@0.11.1
  - @bamboocss/logger@0.11.1

## 0.11.0

### Patch Changes

- dead08a2: Normalize tsconfig path mapping result to posix path.

  It fix not generating pattern styles on windows eventually.

- Updated dependencies [5b95caf5]
- Updated dependencies [811f4fb1]
  - @bamboocss/types@0.11.0
  - @bamboocss/preset-base@0.11.0
  - @bamboocss/preset-bamboo@0.11.0
  - @bamboocss/error@0.11.0
  - @bamboocss/logger@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [24e783b3]
- Updated dependencies [00d11a8b]
- Updated dependencies [1972b4fa]
- Updated dependencies [386e5098]
- Updated dependencies [a669f4d5]
  - @bamboocss/types@0.10.0
  - @bamboocss/preset-base@0.10.0
  - @bamboocss/preset-bamboo@0.10.0
  - @bamboocss/error@0.10.0
  - @bamboocss/logger@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [c08de87f]
  - @bamboocss/preset-base@0.9.0
  - @bamboocss/types@0.9.0
  - @bamboocss/preset-bamboo@0.9.0
  - @bamboocss/error@0.9.0
  - @bamboocss/logger@0.9.0

## 0.8.0

### Patch Changes

- e1f6318a: Fix module resolution issue when using bamboo from a browser environment
- be0ad578: Fix parser issue with TS path mappings
- Updated dependencies [be0ad578]
  - @bamboocss/preset-base@0.8.0
  - @bamboocss/types@0.8.0
  - @bamboocss/preset-bamboo@0.8.0
  - @bamboocss/error@0.8.0
  - @bamboocss/logger@0.8.0

## 0.7.0

### Patch Changes

- 1a05c4bb: Fix issue where hot module reloading is inconsistent in the PostCSS plugin when another internal
  typescript-only package is changed
- Updated dependencies [60a77841]
- Updated dependencies [a9c189b7]
- Updated dependencies [d9eeba60]
  - @bamboocss/preset-base@0.7.0
  - @bamboocss/types@0.7.0
  - @bamboocss/preset-bamboo@0.7.0
  - @bamboocss/error@0.7.0
  - @bamboocss/logger@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [97fbe63f]
- Updated dependencies [08d33e0f]
- Updated dependencies [f7aff8eb]
  - @bamboocss/preset-base@0.6.0
  - @bamboocss/types@0.6.0
  - @bamboocss/error@0.6.0
  - @bamboocss/logger@0.6.0
  - @bamboocss/preset-bamboo@0.6.0

## 0.5.1

### Patch Changes

- 33198907: Create separate entrypoint for merge configs

  ```ts
  import { mergeConfigs } from '@bamboocss/config/merge'
  ```

- 1a2c0e2b: Fix `bamboo.config.xxx` file dependencies detection when using the builder (= with PostCSS or with the
  VSCode extension). It will now also properly resolve tsconfig path aliases.
- Updated dependencies [8c670d60]
- Updated dependencies [f9247e52]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/logger@0.5.1
  - @bamboocss/preset-base@0.5.1
  - @bamboocss/preset-bamboo@0.5.1
  - @bamboocss/error@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [ead9eaa3]
- Updated dependencies [3a87cff8]
  - @bamboocss/types@0.5.0
  - @bamboocss/preset-bamboo@0.5.0
  - @bamboocss/preset-base@0.5.0
  - @bamboocss/error@0.5.0
  - @bamboocss/logger@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [e8024347]
- Updated dependencies [d00eb17c]
- Updated dependencies [9156c1c6]
- Updated dependencies [54a8913c]
- Updated dependencies [0f36ebad]
- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/preset-base@0.4.0
  - @bamboocss/types@0.4.0
  - @bamboocss/preset-bamboo@0.4.0
  - @bamboocss/error@0.4.0
  - @bamboocss/logger@0.4.0

## 0.3.2

### Patch Changes

- 9822d79a: Remove `bundledDependencies` from `package.json` to fix NPM resolution
  - @bamboocss/error@0.3.2
  - @bamboocss/logger@0.3.2
  - @bamboocss/preset-base@0.3.2
  - @bamboocss/preset-bamboo@0.3.2
  - @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/error@0.3.1
  - @bamboocss/logger@0.3.1
  - @bamboocss/preset-base@0.3.1
  - @bamboocss/preset-bamboo@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [bd5c049b]
- Updated dependencies [6d81ee9e]
  - @bamboocss/preset-base@0.3.0
  - @bamboocss/preset-bamboo@0.3.0
  - @bamboocss/types@0.3.0
  - @bamboocss/error@0.3.0
  - @bamboocss/logger@0.3.0

## 0.0.2

### Patch Changes

- c308e8be: Allow asynchronous presets
- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [c308e8be]
- Updated dependencies [fb40fff2]
  - @bamboocss/types@0.0.2
  - @bamboocss/error@0.0.2
  - @bamboocss/logger@0.0.2
