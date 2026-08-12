# @bamboocss/token-dictionary

## 1.37.4

### Patch Changes

- @bamboocss/logger@1.37.4
- @bamboocss/shared@1.37.4
- @bamboocss/types@1.37.4

## 1.37.3

### Patch Changes

- @bamboocss/logger@1.37.3
- @bamboocss/shared@1.37.3
- @bamboocss/types@1.37.3

## 1.37.2

### Patch Changes

- @bamboocss/logger@1.37.2
- @bamboocss/shared@1.37.2
- @bamboocss/types@1.37.2

## 1.37.1

### Patch Changes

- @bamboocss/logger@1.37.1
- @bamboocss/shared@1.37.1
- @bamboocss/types@1.37.1

## 1.37.0

### Patch Changes

- @bamboocss/logger@1.37.0
- @bamboocss/shared@1.37.0
- @bamboocss/types@1.37.0

## 1.36.5

### Patch Changes

- @bamboocss/logger@1.36.5
- @bamboocss/shared@1.36.5
- @bamboocss/types@1.36.5

## 1.36.4

### Patch Changes

- @bamboocss/logger@1.36.4
- @bamboocss/shared@1.36.4
- @bamboocss/types@1.36.4

## 1.36.3

### Patch Changes

- @bamboocss/logger@1.36.3
- @bamboocss/shared@1.36.3
- @bamboocss/types@1.36.3

## 1.36.2

### Patch Changes

- @bamboocss/logger@1.36.2
- @bamboocss/shared@1.36.2
- @bamboocss/types@1.36.2

## 1.36.1

### Patch Changes

- @bamboocss/logger@1.36.1
- @bamboocss/shared@1.36.1
- @bamboocss/types@1.36.1

## 1.36.0

### Patch Changes

- @bamboocss/logger@1.36.0
- @bamboocss/shared@1.36.0
- @bamboocss/types@1.36.0

## 1.35.5

### Patch Changes

- @bamboocss/logger@1.35.5
- @bamboocss/shared@1.35.5
- @bamboocss/types@1.35.5

## 1.35.4

### Patch Changes

- @bamboocss/logger@1.35.4
- @bamboocss/shared@1.35.4
- @bamboocss/types@1.35.4

## 1.35.3

### Patch Changes

- @bamboocss/logger@1.35.3
- @bamboocss/shared@1.35.3
- @bamboocss/types@1.35.3

## 1.35.2

### Patch Changes

- Updated dependencies [eb3025a]
  - @bamboocss/shared@1.35.2
  - @bamboocss/types@1.35.2
  - @bamboocss/logger@1.35.2

## 1.35.1

### Patch Changes

- @bamboocss/logger@1.35.1
- @bamboocss/shared@1.35.1
- @bamboocss/types@1.35.1

## 1.35.0

### Patch Changes

- Updated dependencies [9bfcf31]
  - @bamboocss/types@1.35.0
  - @bamboocss/logger@1.35.0
  - @bamboocss/shared@1.35.0

## 1.34.1

### Patch Changes

- @bamboocss/logger@1.34.1
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

## 1.33.0

### Patch Changes

- Updated dependencies [f7bbc14]
  - @bamboocss/types@1.33.0
  - @bamboocss/logger@1.33.0
  - @bamboocss/shared@1.33.0

## 1.32.0

### Patch Changes

- Updated dependencies [c29044f]
- Updated dependencies [b0ed6dc]
- Updated dependencies [8a66bb9]
- Updated dependencies [2b84dfa]
- Updated dependencies [da792cc]
- Updated dependencies [1cc1860]
- Updated dependencies [c29044f]
- Updated dependencies [f3a8b0d]
- Updated dependencies [c29044f]
  - @bamboocss/shared@1.32.0
  - @bamboocss/types@1.32.0
  - @bamboocss/logger@1.32.0

## 1.31.0

### Minor Changes

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
- Updated dependencies [678bdee]
- Updated dependencies [774048b]
  - @bamboocss/types@1.31.0
  - @bamboocss/logger@1.31.0
  - @bamboocss/shared@1.31.0

## 1.30.1

### Patch Changes

- @bamboocss/logger@1.30.1
- @bamboocss/shared@1.30.1
- @bamboocss/types@1.30.1

## 1.30.0

### Patch Changes

- Updated dependencies
- Updated dependencies [242b24c]
  - @bamboocss/types@1.30.0
  - @bamboocss/shared@1.30.0
  - @bamboocss/logger@1.30.0

## 1.29.0

### Minor Changes

- 38393c4: `token()` now returns the css variable reference for every token, and `token.value()` returns the resolved
  literal.

  ```ts
  token('colors.red.300') // "var(--colors-red-300)"  — was "#fca5a5"
  token.value('colors.red.300') // "#fca5a5"
  token.var('colors.red.300') // unchanged; now an alias of token()
  ```

  **Why.** `token()` used to return the literal for a plain token and the variable reference for a virtual or
  conditional one, so the kind of thing you got back was decided by the theme rather than by the call. Adding a `_dark`
  variant to a token silently changed what every caller received — same call, same path, a colour before and a variable
  after, both typed `string`, with nothing to catch it. Always-a-reference is the predictable half and the one that
  keeps responding to the cascade, so it takes the short name; the literal has to be asked for, which is also the honest
  signal, since it is the form that stops tracking the theme.

  `token.value()` keeps the old per-token split rather than always returning a literal: a virtual or conditional token
  has no single literal, so its `var()` is still the only truthful answer.

  **Migrating.** Rename any call whose result goes somewhere a css variable will not resolve — a `<canvas>` fill, a
  charting library, `<meta name="theme-color">`, or arithmetic on the value — to `token.value()`. Everything else can
  stay as it is and gets better behaviour for free. Nothing throws and no type changes, since both forms return
  `string`, so this is worth grepping for rather than waiting on.

  **Extraction and folding.** `token()`, `token.var()` and `token.value()` are all recognised by the parser and folded
  at build time, including paths built from a constant or template literal the extractor can follow. `token()` is now
  the trivially foldable form: no condition to read and no non-string case to decline.

  **Fixed along the way: negative tokens lost their sign.** A negative token has no css variable of its own — its
  `varRef` names the positive counterpart, and the negation survives only in the value — so a token whose positive
  counterpart carried a condition resolved to a _positive_ length. `token.value('spacing.-gutter')` returned
  `var(--spacing-gutter)` where it should return `calc(var(--spacing-gutter) * -1)`. Both halves now read through the
  token view, so the generated runtime, the extractor and the build-time fold cannot disagree.

  **Stylesheet size.** This makes `pruneUnusedTokens` coarser in one case. Because `token()` can hand back a `var()` for
  any token, a project that reaches for a token from javascript at all now keeps every token declaration, where before
  it kept only the virtual, conditional and negative ones. A project that never imports the tokens artifact is
  unaffected, and one whose paths all resolve statically will be too once the reachability gate is narrowed to
  distinguish them — tracked as follow-up work.

### Patch Changes

- Updated dependencies [0dbe9c4]
- Updated dependencies [6114f6e]
- Updated dependencies [38393c4]
  - @bamboocss/types@1.29.0
  - @bamboocss/logger@1.29.0
  - @bamboocss/shared@1.29.0

## 1.28.1

### Patch Changes

- Updated dependencies [31749e1]
- Updated dependencies [be39dac]
  - @bamboocss/types@1.28.1
  - @bamboocss/logger@1.28.1
  - @bamboocss/shared@1.28.1

## 1.28.0

### Patch Changes

- Updated dependencies [d7fc408]
  - @bamboocss/types@1.28.0
  - @bamboocss/logger@1.28.0
  - @bamboocss/shared@1.28.0

## 1.27.0

### Patch Changes

- @bamboocss/logger@1.27.0
- @bamboocss/shared@1.27.0
- @bamboocss/types@1.27.0

## 1.26.0

### Patch Changes

- @bamboocss/logger@1.26.0
- @bamboocss/shared@1.26.0
- @bamboocss/types@1.26.0

## 1.25.0

### Patch Changes

- @bamboocss/logger@1.25.0
- @bamboocss/shared@1.25.0
- @bamboocss/types@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/logger@1.24.0
- @bamboocss/shared@1.24.0
- @bamboocss/types@1.24.0

## 1.23.0

### Patch Changes

- Updated dependencies [b041398]
- Updated dependencies [087b884]
  - @bamboocss/types@1.23.0
  - @bamboocss/shared@1.23.0
  - @bamboocss/logger@1.23.0

## 1.22.0

### Patch Changes

- Updated dependencies [fe62614]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
  - @bamboocss/types@1.22.0
  - @bamboocss/shared@1.22.0
  - @bamboocss/logger@1.22.0

## 1.21.0

### Patch Changes

- Updated dependencies [81f8789]
  - @bamboocss/shared@1.21.0
  - @bamboocss/types@1.21.0
  - @bamboocss/logger@1.21.0

## 1.20.4

### Patch Changes

- @bamboocss/logger@1.20.4
- @bamboocss/shared@1.20.4
- @bamboocss/types@1.20.4

## 1.20.3

### Patch Changes

- @bamboocss/logger@1.20.3
- @bamboocss/shared@1.20.3
- @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- @bamboocss/logger@1.20.2
- @bamboocss/shared@1.20.2
- @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

- @bamboocss/logger@1.20.1
- @bamboocss/shared@1.20.1
- @bamboocss/types@1.20.1

## 1.20.0

### Patch Changes

- 0441724: Update the runtime dependencies that decide how the framework behaves. Emitted CSS is unchanged — Lightning
  CSS 1.33 produces the sandbox stylesheet byte for byte as 1.31 did.

  | package              |   from |     to | reaches                   |
  | -------------------- | -----: | -----: | ------------------------- |
  | `lightningcss`       | 1.31.1 | 1.33.0 | CSS output when enabled   |
  | `ts-evaluator`       |  1.2.0 |  2.0.0 | expression evaluation     |
  | `chokidar`           |  4.0.3 |  5.0.0 | watch mode                |
  | `@vue/compiler-sfc`  | 3.5.25 | 3.5.41 | Vue SFC extraction        |
  | `@vue/compiler-core` | 3.5.25 | 3.5.41 | the types the above emits |
  | `picomatch`          |  4.0.4 |  4.0.5 | file matching             |

  `@vue/compiler-core` is a dev-only type import in `plugin-vue`, and it was pinned a version behind `compiler-sfc`.
  That had been invisible while both were 3.5.25; moving only `compiler-sfc` put two copies of the AST types in the tree
  and `BaseElementNode` stopped matching the nodes `parse` actually returns. Both move together from here.

  **Three were deliberately left alone**

  `magic-string` stays at 0.30.21. 1.x is ESM-only — `"type": "module"`, no `require` export — and `@bamboocss/vite`,
  `plugin-vue` and `plugin-svelte` all ship a CJS build that emits `require("magic-string")`. It resolves today and
  would not on 1.x, breaking every CJS consumer. Nothing in the suite would notice, since the tests run ESM.

  `open-props` stays at 1.7.16. 1.7.23 hardcodes the shadow scale:

  ```diff
  - --shadow-1: 0 1px 2px -1px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 9%))
  + --shadow-1: 0 1px 2px -1px hsl(220 3% 15% / 10%)
  ```

  The `--shadow-color` and `--shadow-strength` indirection is gone, and with it `--shadow-color-@media:dark` and
  `--inner-shadow-highlight`. `preset-open-props` reads these values straight out of `open-props/src`, so taking the
  bump means shadows stop responding to dark mode. Upstream moved that into separate light and dark files; adopting it
  is a port, not a version bump.

  `typescript` stays at 6.0.2, which is what `@ts-morph/common@0.29.0` bundles. ts-morph 28 is current, so TypeScript 7
  would put the compiler the parser runs on out of step with the one the repo type-checks against.

- Updated dependencies [5d2c91c]
- Updated dependencies [10d7c9b]
- Updated dependencies [aa0f641]
- Updated dependencies [0e2cb31]
  - @bamboocss/types@1.20.0
  - @bamboocss/shared@1.20.0
  - @bamboocss/logger@1.20.0

## 1.19.0

### Patch Changes

- @bamboocss/logger@1.19.0
- @bamboocss/shared@1.19.0
- @bamboocss/types@1.19.0

## 1.18.0

### Patch Changes

- Updated dependencies [21c6daa]
  - @bamboocss/shared@1.18.0
  - @bamboocss/types@1.18.0
  - @bamboocss/logger@1.18.0

## 1.17.3

### Patch Changes

- @bamboocss/types@1.17.3
- @bamboocss/logger@1.17.3
- @bamboocss/shared@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/logger@1.17.2
- @bamboocss/shared@1.17.2
- @bamboocss/types@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [fc381ca]
  - @bamboocss/shared@1.17.1
  - @bamboocss/types@1.17.1
  - @bamboocss/logger@1.17.1

## 1.17.0

### Patch Changes

- Updated dependencies [3cdd0d1]
- Updated dependencies [d5347ab]
- Updated dependencies [c6154dc]
- Updated dependencies [355e573]
  - @bamboocss/shared@1.17.0
  - @bamboocss/types@1.17.0
  - @bamboocss/logger@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/types@1.16.1
- @bamboocss/logger@1.16.1
- @bamboocss/shared@1.16.1

## 1.16.0

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
  - @bamboocss/logger@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/shared@1.15.0
  - @bamboocss/types@1.15.0
  - @bamboocss/logger@1.15.0

## 1.14.0

### Patch Changes

- Updated dependencies [b567114]
- Updated dependencies [d1d05fc]
  - @bamboocss/types@1.14.0
  - @bamboocss/shared@1.14.0
  - @bamboocss/logger@1.14.0

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

## 1.13.1

### Patch Changes

- @bamboocss/logger@1.13.1
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

## 1.12.3

### Patch Changes

- @bamboocss/logger@1.12.3
- @bamboocss/shared@1.12.3
- @bamboocss/types@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/logger@1.12.2
- @bamboocss/shared@1.12.2
- @bamboocss/types@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/logger@1.12.1
- @bamboocss/shared@1.12.1
- @bamboocss/types@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/logger@1.12.0
- @bamboocss/shared@1.12.0
- @bamboocss/types@1.12.0

## 1.11.5

### Patch Changes

- @bamboocss/logger@1.11.5
- @bamboocss/shared@1.11.5
- @bamboocss/types@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/logger@1.11.4
  - @bamboocss/shared@1.11.4
  - @bamboocss/types@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/logger@1.11.3
  - @bamboocss/shared@1.11.3
  - @bamboocss/types@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/logger@1.11.2
  - @bamboocss/shared@1.11.2
  - @bamboocss/types@1.11.2

## 1.11.1

### Patch Changes

- Updated dependencies [2ea9205]
  - @bamboocss/types@1.11.1
  - @bamboocss/logger@1.11.1
  - @bamboocss/shared@1.11.1

## 1.11.0

### Patch Changes

- Updated dependencies [78869ae]
  - @bamboocss/types@1.11.0
  - @bamboocss/logger@1.11.0
  - @bamboocss/shared@1.11.0

## 1.10.0

### Patch Changes

- bc2b8d7: Dependency updates for reported security advisories.
  - **@bamboocss/node** / **@bamboocss/token-dictionary**: bump `picomatch` to 4.0.4
    ([GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p),
    [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj)).
  - **@bamboocss/mcp**: bump `@modelcontextprotocol/sdk` to ^1.25.2.
  - **@bamboocss/astro-plugin-studio**: bump `astro` (dev) to 5.18.1.

- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [8d3b6f8]
- Updated dependencies [44457bb]
  - @bamboocss/types@1.10.0
  - @bamboocss/logger@1.10.0
  - @bamboocss/shared@1.10.0

## 1.9.1

### Patch Changes

- d02fcf6: Fix duplicate token references with special characters resolving incorrectly in composite values

  When the same token reference containing special characters (e.g. `{sizes.0.5}`) appeared more than once in a
  composite value, only the first occurrence was resolved correctly. The second occurrence produced a malformed CSS
  variable name.

  This was caused by `String.replace()` only replacing the first match. Changed to `String.replaceAll()` in
  `Token.expandReferences()` and `expandReferences()` utility.

  **Before (broken):** `--shadows-control-accent: 0 var(--sizes-0\.5) var(--sizes-0-5) rgba(92, 225, 113, 0.25)`

  **After (fixed):** `--shadows-control-accent: 0 var(--sizes-0\.5) var(--sizes-0\.5) rgba(92, 225, 113, 0.25)`
  - @bamboocss/logger@1.9.1
  - @bamboocss/shared@1.9.1
  - @bamboocss/types@1.9.1

## 1.9.0

### Patch Changes

- @bamboocss/logger@1.9.0
- @bamboocss/shared@1.9.0
- @bamboocss/types@1.9.0

## 1.8.2

### Patch Changes

- Updated dependencies [331d1a5]
  - @bamboocss/types@1.8.2
  - @bamboocss/logger@1.8.2
  - @bamboocss/shared@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies [3c86c29]
  - @bamboocss/types@1.8.1
  - @bamboocss/logger@1.8.1
  - @bamboocss/shared@1.8.1

## 1.8.0

### Patch Changes

- @bamboocss/logger@1.8.0
- @bamboocss/shared@1.8.0
- @bamboocss/types@1.8.0

## 1.7.3

### Patch Changes

- @bamboocss/logger@1.7.3
- @bamboocss/shared@1.7.3
- @bamboocss/types@1.7.3

## 1.7.2

### Patch Changes

- @bamboocss/logger@1.7.2
- @bamboocss/shared@1.7.2
- @bamboocss/types@1.7.2

## 1.7.1

### Patch Changes

- @bamboocss/logger@1.7.1
- @bamboocss/shared@1.7.1
- @bamboocss/types@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [86b30b1]
  - @bamboocss/types@1.7.0
  - @bamboocss/logger@1.7.0
  - @bamboocss/shared@1.7.0

## 1.6.1

### Patch Changes

- @bamboocss/logger@1.6.1
- @bamboocss/shared@1.6.1
- @bamboocss/types@1.6.1

## 1.6.0

### Patch Changes

- @bamboocss/logger@1.6.0
- @bamboocss/shared@1.6.0
- @bamboocss/types@1.6.0

## 1.5.1

### Patch Changes

- @bamboocss/logger@1.5.1
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
  - @bamboocss/shared@1.5.0

## 1.4.3

### Patch Changes

- @bamboocss/logger@1.4.3
- @bamboocss/shared@1.4.3
- @bamboocss/types@1.4.3

## 1.4.2

### Patch Changes

- 1290a27: Only log errors that are instances of `BambooError`, preventing test framework and other non-Bamboo errors
  from being logged during development.
- 70420dd: Fix issue where using `token()` or `token.var()` function from `styled-system/tokens` doesn't get resolved by
  the compiler.

  ```tsx
  import { token } from 'styled-system/tokens'
  import { css } from 'styled-system/css'

  css({
    // This didn't work before, but now it does
    outline: `2px solid ${token('colors.gray.500')}`,

    // This has always worked
    outline: `2px solid token('colors.gray.500')`,
  })
  ```

  This also supports fallback values.

  ```tsx
  css({
    color: token('colors.brand.primary', '#3b82f6'),
  })
  ```

- Updated dependencies [1290a27]
  - @bamboocss/shared@1.4.2
  - @bamboocss/types@1.4.2
  - @bamboocss/logger@1.4.2

## 1.4.1

### Patch Changes

- @bamboocss/logger@1.4.1
- @bamboocss/shared@1.4.1
- @bamboocss/types@1.4.1

## 1.4.0

### Patch Changes

- @bamboocss/logger@1.4.0
- @bamboocss/shared@1.4.0
- @bamboocss/types@1.4.0

## 1.3.1

### Patch Changes

- @bamboocss/logger@1.3.1
- @bamboocss/shared@1.3.1
- @bamboocss/types@1.3.1

## 1.3.0

### Patch Changes

- Updated dependencies [70efd73]
  - @bamboocss/types@1.3.0
  - @bamboocss/logger@1.3.0
  - @bamboocss/shared@1.3.0

## 1.2.0

### Patch Changes

- @bamboocss/logger@1.2.0
- @bamboocss/shared@1.2.0
- @bamboocss/types@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [47a0011]
- Updated dependencies [e8ec0aa]
  - @bamboocss/types@1.1.0
  - @bamboocss/shared@1.1.0
  - @bamboocss/logger@1.1.0

## 1.0.1

### Patch Changes

- @bamboocss/logger@1.0.1
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

- Updated dependencies [a3bcbea]
  - @bamboocss/logger@1.0.0
  - @bamboocss/shared@1.0.0
  - @bamboocss/types@1.0.0

## 0.54.0

### Patch Changes

- fdf5142: Fix issue where `borderWidth` token reference adds an extra `px` to the generated css value
- Updated dependencies [efa060d]
- Updated dependencies [d2aede5]
  - @bamboocss/shared@0.54.0
  - @bamboocss/types@0.54.0
  - @bamboocss/logger@0.54.0

## 0.53.7

### Patch Changes

- @bamboocss/logger@0.53.7
- @bamboocss/shared@0.53.7
- @bamboocss/types@0.53.7

## 0.53.6

### Patch Changes

- @bamboocss/logger@0.53.6
- @bamboocss/shared@0.53.6
- @bamboocss/types@0.53.6

## 0.53.5

### Patch Changes

- @bamboocss/logger@0.53.5
- @bamboocss/shared@0.53.5
- @bamboocss/types@0.53.5

## 0.53.4

### Patch Changes

- @bamboocss/logger@0.53.4
- @bamboocss/shared@0.53.4
- @bamboocss/types@0.53.4

## 0.53.3

### Patch Changes

- @bamboocss/logger@0.53.3
- @bamboocss/shared@0.53.3
- @bamboocss/types@0.53.3

## 0.53.2

### Patch Changes

- @bamboocss/logger@0.53.2
- @bamboocss/shared@0.53.2
- @bamboocss/types@0.53.2

## 0.53.1

### Patch Changes

- @bamboocss/logger@0.53.1
- @bamboocss/shared@0.53.1
- @bamboocss/types@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [5286731]
  - @bamboocss/types@0.53.0
  - @bamboocss/logger@0.53.0
  - @bamboocss/shared@0.53.0

## 0.52.0

### Patch Changes

- @bamboocss/logger@0.52.0
- @bamboocss/shared@0.52.0
- @bamboocss/types@0.52.0

## 0.51.1

### Patch Changes

- @bamboocss/logger@0.51.1
- @bamboocss/shared@0.51.1
- @bamboocss/types@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [d68ad1f]
  - @bamboocss/types@0.51.0
  - @bamboocss/logger@0.51.0
  - @bamboocss/shared@0.51.0

## 0.50.0

### Minor Changes

- ad89b90: Add support for semantic tokens in composite shadow `blur`, `offsetX`, `offsetY` and `spread` properties.

  This enables the use of semantic tokens in composite shadow properties.

  ```ts
  // bamboo.config.ts

  export default defineConfig({
    theme: {
      tokens: {
        // ...
        shadows: {
          sm: {
            value: {
              offsetX: '{spacing.3}',
              offsetY: '{spacing.3}',
              blur: '1rem',
              spread: '{spacing.3}',
              color: '{colors.red}',
            },
          },
        },
      },
    },
  })
  ```

### Patch Changes

- Updated dependencies [fea78c7]
- Updated dependencies [ad89b90]
  - @bamboocss/types@0.50.0
  - @bamboocss/logger@0.50.0
  - @bamboocss/shared@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [97a0e4d]
  - @bamboocss/types@0.49.0
  - @bamboocss/logger@0.49.0
  - @bamboocss/shared@0.49.0

## 0.48.1

### Patch Changes

- @bamboocss/logger@0.48.1
- @bamboocss/shared@0.48.1
- @bamboocss/types@0.48.1

## 0.48.0

### Patch Changes

- @bamboocss/logger@0.48.0
- @bamboocss/shared@0.48.0
- @bamboocss/types@0.48.0

## 0.47.1

### Patch Changes

- 144113f: Fix issue where token reference in composite border token generates incorrect css.
  - @bamboocss/logger@0.47.1
  - @bamboocss/shared@0.47.1
  - @bamboocss/types@0.47.1

## 0.47.0

### Minor Changes

- 5e683ee: Add support for cursor token types. Useful for tokenizing cursor types for interactive components.

  Here's an example of how to define a cursor token in your `bamboo.config.ts` file:

  ```ts
  // bamboo.config.ts
  export default defineConfig({
    theme: {
      extend: {
        tokens: {
          cursor: {
            button: { value: 'pointer' },
            checkbox: { value: 'default' },
          },
        },
      },
    },
  })
  ```

  Then you can use the cursor token in your styles or recipes.

  ```tsx
  <button className={css({ cursor: 'button' })}>Click me</button>
  ```

  This makes it easy to manage cursor styles across your application.

### Patch Changes

- Updated dependencies [5e683ee]
  - @bamboocss/types@0.47.0
  - @bamboocss/logger@0.47.0
  - @bamboocss/shared@0.47.0

## 0.46.1

### Patch Changes

- @bamboocss/logger@0.46.1
- @bamboocss/shared@0.46.1
- @bamboocss/types@0.46.1

## 0.46.0

### Patch Changes

- Updated dependencies [54426a2]
  - @bamboocss/shared@0.46.0
  - @bamboocss/types@0.46.0
  - @bamboocss/logger@0.46.0

## 0.45.2

### Patch Changes

- @bamboocss/logger@0.45.2
- @bamboocss/shared@0.45.2
- @bamboocss/types@0.45.2

## 0.45.1

### Patch Changes

- 3439ecf: Fix issue where shadow token with color opacity modifier produces incorrect css value
  - @bamboocss/logger@0.45.1
  - @bamboocss/shared@0.45.1
  - @bamboocss/types@0.45.1

## 0.45.0

### Patch Changes

- a21fcfe: Fix issue where composite border token with `width: 1px` renders `1pxpx` in CSS
- Updated dependencies [dcc9053]
- Updated dependencies [552dd4b]
  - @bamboocss/types@0.45.0
  - @bamboocss/shared@0.45.0
  - @bamboocss/logger@0.45.0

## 0.44.0

### Patch Changes

- Updated dependencies [c99cb75]
  - @bamboocss/types@0.44.0
  - @bamboocss/logger@0.44.0
  - @bamboocss/shared@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [e952f82]
  - @bamboocss/types@0.43.0
  - @bamboocss/logger@0.43.0
  - @bamboocss/shared@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [e157dd1]
- Updated dependencies [19c3a2c]
- Updated dependencies [f00ff88]
- Updated dependencies [17a1932]
  - @bamboocss/types@0.42.0
  - @bamboocss/logger@0.42.0
  - @bamboocss/shared@0.42.0

## 0.41.0

### Patch Changes

- @bamboocss/types@0.41.0
- @bamboocss/logger@0.41.0
- @bamboocss/shared@0.41.0

## 0.40.1

### Patch Changes

- @bamboocss/logger@0.40.1
- @bamboocss/shared@0.40.1
- @bamboocss/types@0.40.1

## 0.40.0

### Patch Changes

- @bamboocss/logger@0.40.0
- @bamboocss/shared@0.40.0
- @bamboocss/types@0.40.0

## 0.39.2

### Patch Changes

- 8b07cdf: Allow nesting (string) token references in the fallback argument, fix an issue where using CSS var in the
  fallback argument would be mistakenly escaped
- Updated dependencies [1f636eb]
  - @bamboocss/shared@0.39.2
  - @bamboocss/types@0.39.2
  - @bamboocss/logger@0.39.2

## 0.39.1

### Patch Changes

- @bamboocss/logger@0.39.1
- @bamboocss/shared@0.39.1
- @bamboocss/types@0.39.1

## 0.39.0

### Patch Changes

- Updated dependencies [221c9a2]
- Updated dependencies [c3e797e]
- Updated dependencies [935ec86]
  - @bamboocss/types@0.39.0
  - @bamboocss/shared@0.39.0
  - @bamboocss/logger@0.39.0

## 0.38.0

### Minor Changes

- bc09d89: Add support for deprecating tokens, utilities, patterns and config recipes.

  Set the `deprecated` property to `true` to enable deprecation warnings. Alternatively, you can also set it to a string
  to provide a custom migration message.

  **Deprecating a utility**

  ```js
  defineConfig({
    utilities: {
      ta: {
        deprecated: true,
        transform(value) {
          return { textAlign: value }
        },
      },
    },
  })
  ```

  **Deprecating a token**

  ```js
  defineConfig({
    theme: {
      tokens: {
        spacing: {
          lg: { value: '8px', deprecated: 'use `8` instead' },
        },
      },
    },
  })
  ```

  **Deprecating a pattern**

  ```js
  defineConfig({
    patterns: {
      customStack: {
        deprecated: true,
      },
    },
  })
  ```

  **Deprecating a recipe**

  ```js
  defineConfig({
    theme: {
      recipes: {
        btn: {
          deprecated: 'will be removed in v2.0',
        },
      },
    },
  })
  ```

  ### ESLint Plugin

  These deprecation warnings will translated into the ESLint plugin as a `no-deprecated` rule.

  ```json
  {
    "rules": {
      "no-deprecated": "warn"
    }
  }
  ```

  In the next release of the ESLint plugin, you will get a warning when using deprecated tokens or utilities.

### Patch Changes

- Updated dependencies [96b47b3]
- Updated dependencies [bc09d89]
- Updated dependencies [2c8b933]
  - @bamboocss/types@0.38.0
  - @bamboocss/shared@0.38.0
  - @bamboocss/logger@0.38.0

## 0.37.2

### Patch Changes

- Updated dependencies [74dfb3e]
  - @bamboocss/types@0.37.2
  - @bamboocss/logger@0.37.2
  - @bamboocss/shared@0.37.2

## 0.37.1

### Patch Changes

- 93dc9f5: Public changes: Some quality of life fixes for the Studio:
  - Handle displaying values using the `[xxx]` escape-hatch syntax for `textStyles` in the studio
  - Display an empty state when there's no token in a specific token page in the studio

  ***

  (mostly) Internal changes:
  - Add `deepResolveReference` in TokenDictionary, helpful to get the raw value from a semantic token by recursively
    traversing the token references.
  - Added some exports in the `@bamboocss/token-dictionary` package, mostly useful when building tooling around Bamboo
    (Prettier/ESLint/VSCode plugin etc)

- Updated dependencies [885963c]
- Updated dependencies [99870bb]
  - @bamboocss/types@0.37.1
  - @bamboocss/shared@0.37.1
  - @bamboocss/logger@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [7daf159]
- Updated dependencies [bcfb5c5]
- Updated dependencies [6247dfb]
  - @bamboocss/shared@0.37.0
  - @bamboocss/types@0.37.0
  - @bamboocss/logger@0.37.0

## 0.36.1

### Patch Changes

- Updated dependencies [bd0cb07]
  - @bamboocss/types@0.36.1
  - @bamboocss/logger@0.36.1
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

- 3af3940: Fix an issue when using a semantic token with one (but not all) condition using the color opacity modifier

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    theme: {
      extend: {
        tokens: {
          colors: {
            black: { value: 'black' },
            white: { value: 'white' },
          },
        },
        semanticTokens: {
          colors: {
            fg: {
              value: {
                base: '{colors.black/87}',
                _dark: '{colors.white}', // <- this was causing a weird issue
              },
            },
          },
        },
      },
    },
  })
  ```

- Updated dependencies [861a280]
- Updated dependencies [2691f16]
- Updated dependencies [340f4f1]
- Updated dependencies [fabdabe]
  - @bamboocss/types@0.36.0
  - @bamboocss/logger@0.36.0
  - @bamboocss/shared@0.36.0

## 0.35.0

### Patch Changes

- f2fdc48: Fix negative `semanticTokens` generation

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    tokens: {
      spacing: {
        1: { value: '1rem' },
      },
    },
    semanticTokens: {
      spacing: {
        lg: { value: '{spacing.1}' },
      },
    },
  })
  ```

  Will now correctly generate the negative value:

  ```diff
  "spacing.-1" => "calc(var(--spacing-1) * -1)",
  - "spacing.-lg" => "{spacing.1}",
  + "spacing.-lg" => "calc(var(--spacing-lg) * -1)",
  ```

- Updated dependencies [50db354]
- Updated dependencies [f6befbf]
- Updated dependencies [a0c4d27]
  - @bamboocss/types@0.35.0
  - @bamboocss/logger@0.35.0
  - @bamboocss/shared@0.35.0

## 0.34.3

### Patch Changes

- @bamboocss/logger@0.34.3
- @bamboocss/shared@0.34.3
- @bamboocss/types@0.34.3

## 0.34.2

### Patch Changes

- @bamboocss/types@0.34.2
- @bamboocss/logger@0.34.2
- @bamboocss/shared@0.34.2

## 0.34.1

### Patch Changes

- d4942e0: Fix the color opacity modifier syntax for `semanticTokens` inside of conditions

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
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
              _light: '{colors.blue.500/32}', // <-- wasn't working as expected
              _dark: '{colors.green.500/half}',
            },
          },
        },
      },
    },
  })
  ```

  will now correctly generate the following CSS:

  ```css
  @layer tokens {
    :where(:root, :host) {
      --colors-blue-500: blue;
      --colors-green-500: green;
      --opacity-half: 0.5;
      --colors-secondary: red;
    }

    .light {
      --colors-secondary: color-mix(in srgb, var(--colors-blue-500) 32%, transparent);
    }

    .dark {
      --colors-secondary: color-mix(in srgb, var(--colors-green-500) 50%, transparent);
    }
  }
  ```

  - @bamboocss/logger@0.34.1
  - @bamboocss/shared@0.34.1
  - @bamboocss/types@0.34.1

## 0.34.0

### Patch Changes

- 64d5144: Allow using the color opacity modifier syntax (`blue.300/70`) in token references:
  - `{colors.blue.300/70}`
  - `token(colors.blue.300/70)`

  Note that this works both in style usage and in build-time config.

  ```ts
  // runtime usage

  import { css } from '../styled-system/css'

  css({ bg: '{colors.blue.300/70}' })
  // => @layer utilities {
  //    .bg_token\(colors\.blue\.300\/70\) {
  //      background: color-mix(in srgb, var(--colors-blue-300) 70%, transparent);
  //    }
  //  }

  css({ bg: 'token(colors.blue.300/70)' })
  // => @layer utilities {
  //    .bg_token\(colors\.blue\.300\/70\) {
  //      background: color-mix(in srgb, var(--colors-blue-300) 70%, transparent);
  //    }
  //  }
  ```

  ```ts
  // build-time usage
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    theme: {
      tokens: {
        colors: {
          blue: {
            300: { value: '#00f' },
          },
        },
      },
      semanticTokens: {
        colors: {
          primary: {
            value: '{colors.blue.300/70}',
          },
        },
      },
    },
  })
  ```

  ```css
  @layer tokens {
    :where(:root, :host) {
      --colors-blue-300: #00f;
      --colors-primary: color-mix(in srgb, var(--colors-blue-300) 70%, transparent);
    }
  }
  ```

- Updated dependencies [d1516c8]
  - @bamboocss/types@0.34.0
  - @bamboocss/logger@0.34.0
  - @bamboocss/shared@0.34.0

## 0.33.0

### Patch Changes

- 34d94cf: Unify the token path syntax when using `formatTokenName`

  Example with the following config:

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    hooks: {
      'tokens:created': ({ configure }) => {
        configure({
          formatTokenName: (path: string[]) => '
  ```

## 0.32.1

### Patch Changes

- 5184771: Using colorPalette with DEFAULT values will now also override the current token path

  Given this config:

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    theme: {
      extend: {
        semanticTokens: {
          colors: {
            bg: {
              primary: {
                DEFAULT: {
                  value: '{colors.red.500}',
                },
                base: {
                  value: '{colors.green.500}',
                },
                hover: {
                  value: '{colors.yellow.300}',
                },
              },
            },
          },
        },
      },
    },
  })
  ```

  And this style usage:

  ```ts
  import { css } from 'styled-system/css'

  css({
    colorPalette: 'bg.primary',
  })
  ```

  This is the difference in the generated css

  ```diff
  @layer utilities {
    .color-palette_bg\\.primary {
  +    --colors-color-palette: var(--colors-bg-primary);
      --colors-color-palette-base: var(--colors-bg-primary-base);
      --colors-color-palette-hover: var(--colors-bg-primary-hover);
    }
  }
  ```

  Which means you can now directly reference the current `colorPalette` like:

  ```diff
  import { css } from 'styled-system/css'

  css({
    colorPalette: 'bg.primary',
  +  backgroundColor: 'colorPalette',
  })
  ```

- 6d8c884: Fix issue where svg asset tokens doesn't work as expected due to unbalanced quotes.
- Updated dependencies [a032375]
- Updated dependencies [89ffb6b]
  - @bamboocss/types@0.32.1
  - @bamboocss/logger@0.32.1
  - @bamboocss/shared@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [8cd8c19]
- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
  - @bamboocss/shared@0.32.0
  - @bamboocss/types@0.32.0
  - @bamboocss/logger@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [8f36f9af]
- Updated dependencies [f0296249]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
  - @bamboocss/types@0.31.0
  - @bamboocss/shared@0.31.0
  - @bamboocss/logger@0.31.0

## 0.30.2

### Patch Changes

- Updated dependencies [6b829cab]
  - @bamboocss/types@0.30.2
  - @bamboocss/logger@0.30.2
  - @bamboocss/shared@0.30.2

## 0.30.1

### Patch Changes

- @bamboocss/logger@0.30.1
- @bamboocss/shared@0.30.1
- @bamboocss/types@0.30.1

## 0.30.0

### Patch Changes

- ab32d1d7: Introduce 3 new hooks:

  ## `tokens:created`

  This hook is called when the token engine has been created. You can use this hook to add your format token names and
  variables.

  > This is especially useful when migrating from other css-in-js libraries, like Stitches.

  ```ts
  export default defineConfig({
    // ...
    hooks: {
      'tokens:created': ({ configure }) => {
        configure({
          formatTokenName: (path) => '
  ```

## 0.29.1

### Patch Changes

- @bamboocss/logger@0.29.1
- @bamboocss/shared@0.29.1
- @bamboocss/types@0.29.1

## 0.29.0

### Patch Changes

- 7c7340ec: Add support for token references with curly braces like `{path.to.token}` in media queries, just like the
  `token(path.to.token)` alternative already could.

  ```ts
  css({
    // ✅ this is fine now, will resolve to something like
    // `@container (min-width: 56em)`
    '@container (min-width: {sizes.4xl})': {
      color: 'green',
    },
  })
  ```

  Fix an issue where the curly token references would not be escaped if the token path was not found.

- Updated dependencies [5fcdeb75]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/logger@0.29.0
  - @bamboocss/shared@0.29.0

## 0.28.0

### Patch Changes

- d4fa5de9: Fix a typing issue where the `borderWidths` wasn't specified in the generated `TokenCategory` type
- Updated dependencies [f58f6df2]
- Updated dependencies [770c7aa4]
  - @bamboocss/types@0.28.0
  - @bamboocss/shared@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/shared@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
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

- bee3ec85: Add support for aspect ratio tokens in the bamboo config or preset. Aspect ratio tokens are used to define
  the aspect ratio of an element.

  ```js
  export default defineConfig({
    // ...
    theme: {
      extend: {
        // add aspect ratio tokens
        tokens: {
          aspectRatios: {
            '1:1': '1',
            '16:9': '16/9',
          },
        },
      },
    },
  })
  ```

  Here's what the default aspect ratio tokens in the base preset looks like:

  ```json
  {
    "square": { "value": "1 / 1" },
    "landscape": { "value": "4 / 3" },
    "portrait": { "value": "3 / 4" },
    "wide": { "value": "16 / 9" },
    "ultrawide": { "value": "18 / 5" },
    "golden": { "value": "1.618 / 1" }
  }
  ```

  **Breaking Change**

  The built-in token values has been removed from the `aspectRatio` utility to the `@bamboocss/preset-base` as a token.

  For most users, this change should be a drop-in replacement. However, if you used a custom preset in the config, you
  might need to update it to include the new aspect ratio tokens.

### Patch Changes

- Updated dependencies [84304901]
- Updated dependencies [74ac0d9d]
  - @bamboocss/shared@0.27.0
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/shared@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/shared@0.26.1
- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0

## 0.25.0

### Minor Changes

- de282f60: Support token reference syntax when authoring styles object, text styles and layer styles.

  ```jsx
  import { css } from '../styled-system/css'

  const styles = css({
    border: '2px solid {colors.primary}',
  })
  ```

  This will resolve the token reference and convert it to css variables.

  ```css
  .border_2px_solid_\{colors\.primary\} {
    border: 2px solid var(--colors-primary);
  }
  ```

  The alternative to this was to use the `token(...)` css function which will be resolved.

  ### `token(...)` vs `{...}`

  Both approaches return the css variable

  ```jsx
  const styles = css({
    // token reference syntax
    border: '2px solid {colors.primary}',
    // token function syntax
    border: '2px solid token(colors.primary)',
  })
  ```

  However, The `token(...)` syntax allows you to set a fallback value.

  ```jsx
  const styles = css({
    border: '2px solid token(colors.primary, red)',
  })
  ```

### Patch Changes

- Updated dependencies [59fd291c]
  - @bamboocss/types@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/shared@0.24.1
- @bamboocss/types@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [f6881022]
  - @bamboocss/types@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- @bamboocss/shared@0.23.0
- @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
  - @bamboocss/types@0.22.1
  - @bamboocss/shared@0.22.1

## 0.22.0

### Patch Changes

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0

## 0.21.0

### Patch Changes

- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/shared@0.18.3
- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 566fd28a: Fix issue where virtual color does not apply DEFAULT color in palette
- 43bfa510: Fix issue where composite tokens (shadows, border, etc) generated incorrect css when using the object syntax
  in semantic tokens.
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/types@0.18.0

## 0.17.5

### Patch Changes

- @bamboocss/shared@0.17.5
- @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/shared@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- Updated dependencies [5ce359f6]
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1

## 0.17.0

### Patch Changes

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0

## 0.16.0

### Patch Changes

- @bamboocss/shared@0.16.0
- @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/shared@0.15.5
- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- @bamboocss/types@0.15.4
- @bamboocss/shared@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/shared@0.15.3
  - @bamboocss/types@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 4e003bfb: - reuse css variable in semantic token alias
- Updated dependencies [26f6982c]
  - @bamboocss/shared@0.15.1
  - @bamboocss/types@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [39298609]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0

## 0.14.0

### Minor Changes

- b1c31fdd: - Introduces deep nested `colorPalettes` for enhanced color management
  - Previous color palette structure was flat and less flexible, now `colorPalettes` can be organized hierarchically for
    improved organization

  **Example**: Define colors within categories, variants and states

  ```js
  const theme = {
    extend: {
      semanticTokens: {
        colors: {
          button: {
            dark: {
              value: 'navy',
            },
            light: {
              DEFAULT: {
                value: 'skyblue',
              },
              accent: {
                DEFAULT: {
                  value: 'cyan',
                },
                secondary: {
                  value: 'blue',
                },
              },
            },
          },
        },
      },
    },
  }
  ```

  You can now use the root `button` color palette and its values directly:

  ```tsx
  import { css } from '../styled-system/css'

  export const App = () => {
    return (
      <button
        className={css({
          colorPalette: 'button',
          color: 'colorPalette.light',
          backgroundColor: 'colorPalette.dark',
          _hover: {
            color: 'colorPalette.light.accent',
            background: 'colorPalette.light.accent.secondary',
          },
        })}
      >
        Root color palette
      </button>
    )
  }
  ```

  Or you can use any deeply nested property (e.g. `button.light.accent`) as a root color palette:

  ```tsx
  import { css } from '../styled-system/css'

  export const App = () => {
    return (
      <button
        className={css({
          colorPalette: 'button.light.accent',
          color: 'colorPalette.secondary',
        })}
      >
        Nested color palette leaf
      </button>
    )
  }
  ```

### Patch Changes

- 9e799554: Fix issue where negative spacing tokens doesn't respect hash option
- Updated dependencies [8106b411]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/types@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- @bamboocss/shared@0.13.1
- @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- @bamboocss/shared@0.13.0
- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/shared@0.12.2
- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/shared@0.12.1
- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- @bamboocss/shared@0.12.0
- @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- Updated dependencies [c07e1beb]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/types@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/shared@0.11.0

## 0.10.0

### Patch Changes

- 9d4aa918: Fix issue where svg asset tokens are seen as invalid in the browser
- Updated dependencies [24e783b3]
- Updated dependencies [386e5098]
- Updated dependencies [a669f4d5]
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [c08de87f]
  - @bamboocss/types@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

### Patch Changes

- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- Updated dependencies [be0ad578]
  - @bamboocss/types@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0

## 0.6.0

### Patch Changes

- @bamboocss/types@0.6.0
- @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/types@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/shared@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/shared@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/shared@0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [c308e8be]
- Updated dependencies [fb40fff2]
  - @bamboocss/types@0.0.2
  - @bamboocss/shared@0.0.2

* path.join('-'), }) }, }, })

````

## `utility:created`

This hook is called when the internal classname engine has been created. You can override the default `toHash` function
used when `config.hash` is set to `true`

```ts
export default defineConfig({
  // ...
  hooks: {
    'utility:created': ({ configure }) => {
      configure({
        toHash: (paths, toHash) => {
          const stringConds = paths.join(':')
          const splitConds = stringConds.split('_')
          const hashConds = splitConds.map(toHash)
          return hashConds.join('_')
        },
      })
    },
  },
})
````

## `codegen:prepare`

This hook is called right before writing the codegen files to disk. You can use this hook to tweak the codegen files

```ts
export default defineConfig({
  // ...
  hooks: {
    'codegen:prepare': ({ artifacts, changed }) => {
      // do something with the emitted js/d.ts files
    },
  },
})
```

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

## 0.29.1

### Patch Changes

- @bamboocss/logger@0.29.1
- @bamboocss/shared@0.29.1
- @bamboocss/types@0.29.1

## 0.29.0

### Patch Changes

- 7c7340ec: Add support for token references with curly braces like `{path.to.token}` in media queries, just like the
  `token(path.to.token)` alternative already could.

  ```ts
  css({
    // ✅ this is fine now, will resolve to something like
    // `@container (min-width: 56em)`
    '@container (min-width: {sizes.4xl})': {
      color: 'green',
    },
  })
  ```

  Fix an issue where the curly token references would not be escaped if the token path was not found.

- Updated dependencies [5fcdeb75]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/logger@0.29.0
  - @bamboocss/shared@0.29.0

## 0.28.0

### Patch Changes

- d4fa5de9: Fix a typing issue where the `borderWidths` wasn't specified in the generated `TokenCategory` type
- Updated dependencies [f58f6df2]
- Updated dependencies [770c7aa4]
  - @bamboocss/types@0.28.0
  - @bamboocss/shared@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/shared@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
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

- bee3ec85: Add support for aspect ratio tokens in the bamboo config or preset. Aspect ratio tokens are used to define
  the aspect ratio of an element.

  ```js
  export default defineConfig({
    // ...
    theme: {
      extend: {
        // add aspect ratio tokens
        tokens: {
          aspectRatios: {
            '1:1': '1',
            '16:9': '16/9',
          },
        },
      },
    },
  })
  ```

  Here's what the default aspect ratio tokens in the base preset looks like:

  ```json
  {
    "square": { "value": "1 / 1" },
    "landscape": { "value": "4 / 3" },
    "portrait": { "value": "3 / 4" },
    "wide": { "value": "16 / 9" },
    "ultrawide": { "value": "18 / 5" },
    "golden": { "value": "1.618 / 1" }
  }
  ```

  **Breaking Change**

  The built-in token values has been removed from the `aspectRatio` utility to the `@bamboocss/preset-base` as a token.

  For most users, this change should be a drop-in replacement. However, if you used a custom preset in the config, you
  might need to update it to include the new aspect ratio tokens.

### Patch Changes

- Updated dependencies [84304901]
- Updated dependencies [74ac0d9d]
  - @bamboocss/shared@0.27.0
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/shared@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/shared@0.26.1
- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0

## 0.25.0

### Minor Changes

- de282f60: Support token reference syntax when authoring styles object, text styles and layer styles.

  ```jsx
  import { css } from '../styled-system/css'

  const styles = css({
    border: '2px solid {colors.primary}',
  })
  ```

  This will resolve the token reference and convert it to css variables.

  ```css
  .border_2px_solid_\{colors\.primary\} {
    border: 2px solid var(--colors-primary);
  }
  ```

  The alternative to this was to use the `token(...)` css function which will be resolved.

  ### `token(...)` vs `{...}`

  Both approaches return the css variable

  ```jsx
  const styles = css({
    // token reference syntax
    border: '2px solid {colors.primary}',
    // token function syntax
    border: '2px solid token(colors.primary)',
  })
  ```

  However, The `token(...)` syntax allows you to set a fallback value.

  ```jsx
  const styles = css({
    border: '2px solid token(colors.primary, red)',
  })
  ```

### Patch Changes

- Updated dependencies [59fd291c]
  - @bamboocss/types@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/shared@0.24.1
- @bamboocss/types@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [f6881022]
  - @bamboocss/types@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- @bamboocss/shared@0.23.0
- @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
  - @bamboocss/types@0.22.1
  - @bamboocss/shared@0.22.1

## 0.22.0

### Patch Changes

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0

## 0.21.0

### Patch Changes

- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/shared@0.18.3
- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 566fd28a: Fix issue where virtual color does not apply DEFAULT color in palette
- 43bfa510: Fix issue where composite tokens (shadows, border, etc) generated incorrect css when using the object syntax
  in semantic tokens.
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/types@0.18.0

## 0.17.5

### Patch Changes

- @bamboocss/shared@0.17.5
- @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/shared@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- Updated dependencies [5ce359f6]
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1

## 0.17.0

### Patch Changes

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0

## 0.16.0

### Patch Changes

- @bamboocss/shared@0.16.0
- @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/shared@0.15.5
- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- @bamboocss/types@0.15.4
- @bamboocss/shared@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/shared@0.15.3
  - @bamboocss/types@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 4e003bfb: - reuse css variable in semantic token alias
- Updated dependencies [26f6982c]
  - @bamboocss/shared@0.15.1
  - @bamboocss/types@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [39298609]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0

## 0.14.0

### Minor Changes

- b1c31fdd: - Introduces deep nested `colorPalettes` for enhanced color management
  - Previous color palette structure was flat and less flexible, now `colorPalettes` can be organized hierarchically for
    improved organization

  **Example**: Define colors within categories, variants and states

  ```js
  const theme = {
    extend: {
      semanticTokens: {
        colors: {
          button: {
            dark: {
              value: 'navy',
            },
            light: {
              DEFAULT: {
                value: 'skyblue',
              },
              accent: {
                DEFAULT: {
                  value: 'cyan',
                },
                secondary: {
                  value: 'blue',
                },
              },
            },
          },
        },
      },
    },
  }
  ```

  You can now use the root `button` color palette and its values directly:

  ```tsx
  import { css } from '../styled-system/css'

  export const App = () => {
    return (
      <button
        className={css({
          colorPalette: 'button',
          color: 'colorPalette.light',
          backgroundColor: 'colorPalette.dark',
          _hover: {
            color: 'colorPalette.light.accent',
            background: 'colorPalette.light.accent.secondary',
          },
        })}
      >
        Root color palette
      </button>
    )
  }
  ```

  Or you can use any deeply nested property (e.g. `button.light.accent`) as a root color palette:

  ```tsx
  import { css } from '../styled-system/css'

  export const App = () => {
    return (
      <button
        className={css({
          colorPalette: 'button.light.accent',
          color: 'colorPalette.secondary',
        })}
      >
        Nested color palette leaf
      </button>
    )
  }
  ```

### Patch Changes

- 9e799554: Fix issue where negative spacing tokens doesn't respect hash option
- Updated dependencies [8106b411]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/types@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- @bamboocss/shared@0.13.1
- @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- @bamboocss/shared@0.13.0
- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/shared@0.12.2
- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/shared@0.12.1
- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- @bamboocss/shared@0.12.0
- @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- Updated dependencies [c07e1beb]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/types@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/shared@0.11.0

## 0.10.0

### Patch Changes

- 9d4aa918: Fix issue where svg asset tokens are seen as invalid in the browser
- Updated dependencies [24e783b3]
- Updated dependencies [386e5098]
- Updated dependencies [a669f4d5]
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [c08de87f]
  - @bamboocss/types@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

### Patch Changes

- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- Updated dependencies [be0ad578]
  - @bamboocss/types@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0

## 0.6.0

### Patch Changes

- @bamboocss/types@0.6.0
- @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/types@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/shared@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/shared@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/shared@0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [c308e8be]
- Updated dependencies [fb40fff2]
  - @bamboocss/types@0.0.2
  - @bamboocss/shared@0.0.2

* path.join('-'), }) }, }, })

````

Will now allow you to use the following syntax for token path:

```diff
- css({ boxShadow: '10px 10px 10px {colors.$primary}' })
+ css({ boxShadow: '10px 10px 10px {$colors-primary}' })

- token.var('colors.$primary')
+ token.var('$colors-black')
````

- e855c64: Fix svg token asset quotes
- Updated dependencies [cca50d5]
- Updated dependencies [fde37d8]
  - @bamboocss/types@0.33.0
  - @bamboocss/logger@0.33.0
  - @bamboocss/shared@0.33.0

## 0.32.1

### Patch Changes

- 5184771: Using colorPalette with DEFAULT values will now also override the current token path

  Given this config:

  ```ts
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    theme: {
      extend: {
        semanticTokens: {
          colors: {
            bg: {
              primary: {
                DEFAULT: {
                  value: '{colors.red.500}',
                },
                base: {
                  value: '{colors.green.500}',
                },
                hover: {
                  value: '{colors.yellow.300}',
                },
              },
            },
          },
        },
      },
    },
  })
  ```

  And this style usage:

  ```ts
  import { css } from 'styled-system/css'

  css({
    colorPalette: 'bg.primary',
  })
  ```

  This is the difference in the generated css

  ```diff
  @layer utilities {
    .color-palette_bg\\.primary {
  +    --colors-color-palette: var(--colors-bg-primary);
      --colors-color-palette-base: var(--colors-bg-primary-base);
      --colors-color-palette-hover: var(--colors-bg-primary-hover);
    }
  }
  ```

  Which means you can now directly reference the current `colorPalette` like:

  ```diff
  import { css } from 'styled-system/css'

  css({
    colorPalette: 'bg.primary',
  +  backgroundColor: 'colorPalette',
  })
  ```

- 6d8c884: Fix issue where svg asset tokens doesn't work as expected due to unbalanced quotes.
- Updated dependencies [a032375]
- Updated dependencies [89ffb6b]
  - @bamboocss/types@0.32.1
  - @bamboocss/logger@0.32.1
  - @bamboocss/shared@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [8cd8c19]
- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
  - @bamboocss/shared@0.32.0
  - @bamboocss/types@0.32.0
  - @bamboocss/logger@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [8f36f9af]
- Updated dependencies [f0296249]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
  - @bamboocss/types@0.31.0
  - @bamboocss/shared@0.31.0
  - @bamboocss/logger@0.31.0

## 0.30.2

### Patch Changes

- Updated dependencies [6b829cab]
  - @bamboocss/types@0.30.2
  - @bamboocss/logger@0.30.2
  - @bamboocss/shared@0.30.2

## 0.30.1

### Patch Changes

- @bamboocss/logger@0.30.1
- @bamboocss/shared@0.30.1
- @bamboocss/types@0.30.1

## 0.30.0

### Patch Changes

- ab32d1d7: Introduce 3 new hooks:

  ## `tokens:created`

  This hook is called when the token engine has been created. You can use this hook to add your format token names and
  variables.

  > This is especially useful when migrating from other css-in-js libraries, like Stitches.

  ```ts
  export default defineConfig({
    // ...
    hooks: {
      'tokens:created': ({ configure }) => {
        configure({
          formatTokenName: (path) => '
  ```

## 0.29.1

### Patch Changes

- @bamboocss/logger@0.29.1
- @bamboocss/shared@0.29.1
- @bamboocss/types@0.29.1

## 0.29.0

### Patch Changes

- 7c7340ec: Add support for token references with curly braces like `{path.to.token}` in media queries, just like the
  `token(path.to.token)` alternative already could.

  ```ts
  css({
    // ✅ this is fine now, will resolve to something like
    // `@container (min-width: 56em)`
    '@container (min-width: {sizes.4xl})': {
      color: 'green',
    },
  })
  ```

  Fix an issue where the curly token references would not be escaped if the token path was not found.

- Updated dependencies [5fcdeb75]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/logger@0.29.0
  - @bamboocss/shared@0.29.0

## 0.28.0

### Patch Changes

- d4fa5de9: Fix a typing issue where the `borderWidths` wasn't specified in the generated `TokenCategory` type
- Updated dependencies [f58f6df2]
- Updated dependencies [770c7aa4]
  - @bamboocss/types@0.28.0
  - @bamboocss/shared@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/shared@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
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

- bee3ec85: Add support for aspect ratio tokens in the bamboo config or preset. Aspect ratio tokens are used to define
  the aspect ratio of an element.

  ```js
  export default defineConfig({
    // ...
    theme: {
      extend: {
        // add aspect ratio tokens
        tokens: {
          aspectRatios: {
            '1:1': '1',
            '16:9': '16/9',
          },
        },
      },
    },
  })
  ```

  Here's what the default aspect ratio tokens in the base preset looks like:

  ```json
  {
    "square": { "value": "1 / 1" },
    "landscape": { "value": "4 / 3" },
    "portrait": { "value": "3 / 4" },
    "wide": { "value": "16 / 9" },
    "ultrawide": { "value": "18 / 5" },
    "golden": { "value": "1.618 / 1" }
  }
  ```

  **Breaking Change**

  The built-in token values has been removed from the `aspectRatio` utility to the `@bamboocss/preset-base` as a token.

  For most users, this change should be a drop-in replacement. However, if you used a custom preset in the config, you
  might need to update it to include the new aspect ratio tokens.

### Patch Changes

- Updated dependencies [84304901]
- Updated dependencies [74ac0d9d]
  - @bamboocss/shared@0.27.0
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/shared@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/shared@0.26.1
- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0

## 0.25.0

### Minor Changes

- de282f60: Support token reference syntax when authoring styles object, text styles and layer styles.

  ```jsx
  import { css } from '../styled-system/css'

  const styles = css({
    border: '2px solid {colors.primary}',
  })
  ```

  This will resolve the token reference and convert it to css variables.

  ```css
  .border_2px_solid_\{colors\.primary\} {
    border: 2px solid var(--colors-primary);
  }
  ```

  The alternative to this was to use the `token(...)` css function which will be resolved.

  ### `token(...)` vs `{...}`

  Both approaches return the css variable

  ```jsx
  const styles = css({
    // token reference syntax
    border: '2px solid {colors.primary}',
    // token function syntax
    border: '2px solid token(colors.primary)',
  })
  ```

  However, The `token(...)` syntax allows you to set a fallback value.

  ```jsx
  const styles = css({
    border: '2px solid token(colors.primary, red)',
  })
  ```

### Patch Changes

- Updated dependencies [59fd291c]
  - @bamboocss/types@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/shared@0.24.1
- @bamboocss/types@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [f6881022]
  - @bamboocss/types@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- @bamboocss/shared@0.23.0
- @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
  - @bamboocss/types@0.22.1
  - @bamboocss/shared@0.22.1

## 0.22.0

### Patch Changes

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0

## 0.21.0

### Patch Changes

- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/shared@0.18.3
- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 566fd28a: Fix issue where virtual color does not apply DEFAULT color in palette
- 43bfa510: Fix issue where composite tokens (shadows, border, etc) generated incorrect css when using the object syntax
  in semantic tokens.
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/types@0.18.0

## 0.17.5

### Patch Changes

- @bamboocss/shared@0.17.5
- @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/shared@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- Updated dependencies [5ce359f6]
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1

## 0.17.0

### Patch Changes

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0

## 0.16.0

### Patch Changes

- @bamboocss/shared@0.16.0
- @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/shared@0.15.5
- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- @bamboocss/types@0.15.4
- @bamboocss/shared@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/shared@0.15.3
  - @bamboocss/types@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 4e003bfb: - reuse css variable in semantic token alias
- Updated dependencies [26f6982c]
  - @bamboocss/shared@0.15.1
  - @bamboocss/types@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [39298609]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0

## 0.14.0

### Minor Changes

- b1c31fdd: - Introduces deep nested `colorPalettes` for enhanced color management
  - Previous color palette structure was flat and less flexible, now `colorPalettes` can be organized hierarchically for
    improved organization

  **Example**: Define colors within categories, variants and states

  ```js
  const theme = {
    extend: {
      semanticTokens: {
        colors: {
          button: {
            dark: {
              value: 'navy',
            },
            light: {
              DEFAULT: {
                value: 'skyblue',
              },
              accent: {
                DEFAULT: {
                  value: 'cyan',
                },
                secondary: {
                  value: 'blue',
                },
              },
            },
          },
        },
      },
    },
  }
  ```

  You can now use the root `button` color palette and its values directly:

  ```tsx
  import { css } from '../styled-system/css'

  export const App = () => {
    return (
      <button
        className={css({
          colorPalette: 'button',
          color: 'colorPalette.light',
          backgroundColor: 'colorPalette.dark',
          _hover: {
            color: 'colorPalette.light.accent',
            background: 'colorPalette.light.accent.secondary',
          },
        })}
      >
        Root color palette
      </button>
    )
  }
  ```

  Or you can use any deeply nested property (e.g. `button.light.accent`) as a root color palette:

  ```tsx
  import { css } from '../styled-system/css'

  export const App = () => {
    return (
      <button
        className={css({
          colorPalette: 'button.light.accent',
          color: 'colorPalette.secondary',
        })}
      >
        Nested color palette leaf
      </button>
    )
  }
  ```

### Patch Changes

- 9e799554: Fix issue where negative spacing tokens doesn't respect hash option
- Updated dependencies [8106b411]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/types@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- @bamboocss/shared@0.13.1
- @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- @bamboocss/shared@0.13.0
- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/shared@0.12.2
- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/shared@0.12.1
- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- @bamboocss/shared@0.12.0
- @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- Updated dependencies [c07e1beb]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/types@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/shared@0.11.0

## 0.10.0

### Patch Changes

- 9d4aa918: Fix issue where svg asset tokens are seen as invalid in the browser
- Updated dependencies [24e783b3]
- Updated dependencies [386e5098]
- Updated dependencies [a669f4d5]
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [c08de87f]
  - @bamboocss/types@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

### Patch Changes

- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- Updated dependencies [be0ad578]
  - @bamboocss/types@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0

## 0.6.0

### Patch Changes

- @bamboocss/types@0.6.0
- @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/types@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/shared@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/shared@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/shared@0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [c308e8be]
- Updated dependencies [fb40fff2]
  - @bamboocss/types@0.0.2
  - @bamboocss/shared@0.0.2

* path.join('-'), }) }, }, })

````

## `utility:created`

This hook is called when the internal classname engine has been created. You can override the default `toHash` function
used when `config.hash` is set to `true`

```ts
export default defineConfig({
  // ...
  hooks: {
    'utility:created': ({ configure }) => {
      configure({
        toHash: (paths, toHash) => {
          const stringConds = paths.join(':')
          const splitConds = stringConds.split('_')
          const hashConds = splitConds.map(toHash)
          return hashConds.join('_')
        },
      })
    },
  },
})
````

## `codegen:prepare`

This hook is called right before writing the codegen files to disk. You can use this hook to tweak the codegen files

```ts
export default defineConfig({
  // ...
  hooks: {
    'codegen:prepare': ({ artifacts, changed }) => {
      // do something with the emitted js/d.ts files
    },
  },
})
```

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

## 0.29.1

### Patch Changes

- @bamboocss/logger@0.29.1
- @bamboocss/shared@0.29.1
- @bamboocss/types@0.29.1

## 0.29.0

### Patch Changes

- 7c7340ec: Add support for token references with curly braces like `{path.to.token}` in media queries, just like the
  `token(path.to.token)` alternative already could.

  ```ts
  css({
    // ✅ this is fine now, will resolve to something like
    // `@container (min-width: 56em)`
    '@container (min-width: {sizes.4xl})': {
      color: 'green',
    },
  })
  ```

  Fix an issue where the curly token references would not be escaped if the token path was not found.

- Updated dependencies [5fcdeb75]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0
  - @bamboocss/logger@0.29.0
  - @bamboocss/shared@0.29.0

## 0.28.0

### Patch Changes

- d4fa5de9: Fix a typing issue where the `borderWidths` wasn't specified in the generated `TokenCategory` type
- Updated dependencies [f58f6df2]
- Updated dependencies [770c7aa4]
  - @bamboocss/types@0.28.0
  - @bamboocss/shared@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3
  - @bamboocss/shared@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/shared@0.27.2
- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1
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

- bee3ec85: Add support for aspect ratio tokens in the bamboo config or preset. Aspect ratio tokens are used to define
  the aspect ratio of an element.

  ```js
  export default defineConfig({
    // ...
    theme: {
      extend: {
        // add aspect ratio tokens
        tokens: {
          aspectRatios: {
            '1:1': '1',
            '16:9': '16/9',
          },
        },
      },
    },
  })
  ```

  Here's what the default aspect ratio tokens in the base preset looks like:

  ```json
  {
    "square": { "value": "1 / 1" },
    "landscape": { "value": "4 / 3" },
    "portrait": { "value": "3 / 4" },
    "wide": { "value": "16 / 9" },
    "ultrawide": { "value": "18 / 5" },
    "golden": { "value": "1.618 / 1" }
  }
  ```

  **Breaking Change**

  The built-in token values has been removed from the `aspectRatio` utility to the `@bamboocss/preset-base` as a token.

  For most users, this change should be a drop-in replacement. However, if you used a custom preset in the config, you
  might need to update it to include the new aspect ratio tokens.

### Patch Changes

- Updated dependencies [84304901]
- Updated dependencies [74ac0d9d]
  - @bamboocss/shared@0.27.0
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/shared@0.26.2
- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/shared@0.26.1
- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- Updated dependencies [657ca5da]
- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/shared@0.26.0
  - @bamboocss/types@0.26.0

## 0.25.0

### Minor Changes

- de282f60: Support token reference syntax when authoring styles object, text styles and layer styles.

  ```jsx
  import { css } from '../styled-system/css'

  const styles = css({
    border: '2px solid {colors.primary}',
  })
  ```

  This will resolve the token reference and convert it to css variables.

  ```css
  .border_2px_solid_\{colors\.primary\} {
    border: 2px solid var(--colors-primary);
  }
  ```

  The alternative to this was to use the `token(...)` css function which will be resolved.

  ### `token(...)` vs `{...}`

  Both approaches return the css variable

  ```jsx
  const styles = css({
    // token reference syntax
    border: '2px solid {colors.primary}',
    // token function syntax
    border: '2px solid token(colors.primary)',
  })
  ```

  However, The `token(...)` syntax allows you to set a fallback value.

  ```jsx
  const styles = css({
    border: '2px solid token(colors.primary, red)',
  })
  ```

### Patch Changes

- Updated dependencies [59fd291c]
  - @bamboocss/types@0.25.0
  - @bamboocss/shared@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
  - @bamboocss/shared@0.24.2
  - @bamboocss/types@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/shared@0.24.1
- @bamboocss/types@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [f6881022]
  - @bamboocss/types@0.24.0
  - @bamboocss/shared@0.24.0

## 0.23.0

### Patch Changes

- @bamboocss/shared@0.23.0
- @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
- Updated dependencies [647f05c9]
  - @bamboocss/types@0.22.1
  - @bamboocss/shared@0.22.1

## 0.22.0

### Patch Changes

- Updated dependencies [526c6e34]
- Updated dependencies [8db47ec6]
  - @bamboocss/types@0.22.0
  - @bamboocss/shared@0.22.0

## 0.21.0

### Patch Changes

- Updated dependencies [26e6051a]
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/shared@0.21.0
  - @bamboocss/types@0.21.0

## 0.20.1

### Patch Changes

- @bamboocss/shared@0.20.1
- @bamboocss/types@0.20.1

## 0.20.0

### Patch Changes

- Updated dependencies [24ee49a5]
- Updated dependencies [904aec7b]
  - @bamboocss/types@0.20.0
  - @bamboocss/shared@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [61831040]
- Updated dependencies [89f86923]
  - @bamboocss/types@0.19.0
  - @bamboocss/shared@0.19.0

## 0.18.3

### Patch Changes

- @bamboocss/shared@0.18.3
- @bamboocss/types@0.18.3

## 0.18.2

### Patch Changes

- @bamboocss/shared@0.18.2
- @bamboocss/types@0.18.2

## 0.18.1

### Patch Changes

- 566fd28a: Fix issue where virtual color does not apply DEFAULT color in palette
- 43bfa510: Fix issue where composite tokens (shadows, border, etc) generated incorrect css when using the object syntax
  in semantic tokens.
  - @bamboocss/shared@0.18.1
  - @bamboocss/types@0.18.1

## 0.18.0

### Patch Changes

- Updated dependencies [ba9e32fa]
  - @bamboocss/shared@0.18.0
  - @bamboocss/types@0.18.0

## 0.17.5

### Patch Changes

- @bamboocss/shared@0.17.5
- @bamboocss/types@0.17.5

## 0.17.4

### Patch Changes

- Updated dependencies [fa77080a]
  - @bamboocss/types@0.17.4
  - @bamboocss/shared@0.17.4

## 0.17.3

### Patch Changes

- Updated dependencies [529a262e]
  - @bamboocss/types@0.17.3
  - @bamboocss/shared@0.17.3

## 0.17.2

### Patch Changes

- @bamboocss/shared@0.17.2
- @bamboocss/types@0.17.2

## 0.17.1

### Patch Changes

- Updated dependencies [5ce359f6]
  - @bamboocss/shared@0.17.1
  - @bamboocss/types@0.17.1

## 0.17.0

### Patch Changes

- Updated dependencies [12281ff8]
- Updated dependencies [fc4688e6]
  - @bamboocss/shared@0.17.0
  - @bamboocss/types@0.17.0

## 0.16.0

### Patch Changes

- @bamboocss/shared@0.16.0
- @bamboocss/types@0.16.0

## 0.15.5

### Patch Changes

- @bamboocss/shared@0.15.5
- @bamboocss/types@0.15.5

## 0.15.4

### Patch Changes

- @bamboocss/types@0.15.4
- @bamboocss/shared@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies [95b06bb1]
- Updated dependencies [1ac2011b]
- Updated dependencies [58743bc4]
  - @bamboocss/shared@0.15.3
  - @bamboocss/types@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [26a788c0]
  - @bamboocss/types@0.15.2
  - @bamboocss/shared@0.15.2

## 0.15.1

### Patch Changes

- 4e003bfb: - reuse css variable in semantic token alias
- Updated dependencies [26f6982c]
  - @bamboocss/shared@0.15.1
  - @bamboocss/types@0.15.1

## 0.15.0

### Patch Changes

- Updated dependencies [4bc515ea]
- Updated dependencies [9f429d35]
- Updated dependencies [39298609]
- Updated dependencies [f27146d6]
  - @bamboocss/types@0.15.0
  - @bamboocss/shared@0.15.0

## 0.14.0

### Minor Changes

- b1c31fdd: - Introduces deep nested `colorPalettes` for enhanced color management
  - Previous color palette structure was flat and less flexible, now `colorPalettes` can be organized hierarchically for
    improved organization

  **Example**: Define colors within categories, variants and states

  ```js
  const theme = {
    extend: {
      semanticTokens: {
        colors: {
          button: {
            dark: {
              value: 'navy',
            },
            light: {
              DEFAULT: {
                value: 'skyblue',
              },
              accent: {
                DEFAULT: {
                  value: 'cyan',
                },
                secondary: {
                  value: 'blue',
                },
              },
            },
          },
        },
      },
    },
  }
  ```

  You can now use the root `button` color palette and its values directly:

  ```tsx
  import { css } from '../styled-system/css'

  export const App = () => {
    return (
      <button
        className={css({
          colorPalette: 'button',
          color: 'colorPalette.light',
          backgroundColor: 'colorPalette.dark',
          _hover: {
            color: 'colorPalette.light.accent',
            background: 'colorPalette.light.accent.secondary',
          },
        })}
      >
        Root color palette
      </button>
    )
  }
  ```

  Or you can use any deeply nested property (e.g. `button.light.accent`) as a root color palette:

  ```tsx
  import { css } from '../styled-system/css'

  export const App = () => {
    return (
      <button
        className={css({
          colorPalette: 'button.light.accent',
          color: 'colorPalette.secondary',
        })}
      >
        Nested color palette leaf
      </button>
    )
  }
  ```

### Patch Changes

- 9e799554: Fix issue where negative spacing tokens doesn't respect hash option
- Updated dependencies [8106b411]
- Updated dependencies [e6459a59]
- Updated dependencies [6f7ee198]
  - @bamboocss/types@0.14.0
  - @bamboocss/shared@0.14.0

## 0.13.1

### Patch Changes

- @bamboocss/shared@0.13.1
- @bamboocss/types@0.13.1

## 0.13.0

### Patch Changes

- @bamboocss/shared@0.13.0
- @bamboocss/types@0.13.0

## 0.12.2

### Patch Changes

- @bamboocss/shared@0.12.2
- @bamboocss/types@0.12.2

## 0.12.1

### Patch Changes

- @bamboocss/shared@0.12.1
- @bamboocss/types@0.12.1

## 0.12.0

### Patch Changes

- @bamboocss/shared@0.12.0
- @bamboocss/types@0.12.0

## 0.11.1

### Patch Changes

- Updated dependencies [c07e1beb]
- Updated dependencies [23b516f4]
  - @bamboocss/shared@0.11.1
  - @bamboocss/types@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [5b95caf5]
  - @bamboocss/types@0.11.0
  - @bamboocss/shared@0.11.0

## 0.10.0

### Patch Changes

- 9d4aa918: Fix issue where svg asset tokens are seen as invalid in the browser
- Updated dependencies [24e783b3]
- Updated dependencies [386e5098]
- Updated dependencies [a669f4d5]
  - @bamboocss/shared@0.10.0
  - @bamboocss/types@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [c08de87f]
  - @bamboocss/types@0.9.0
  - @bamboocss/shared@0.9.0

## 0.8.0

### Patch Changes

- ac078416: Fix issue with extracting nested tokens as color-palette. Fix issue with extracting shadow array as a
  separate unnamed block for the custom dark condition.
- Updated dependencies [be0ad578]
  - @bamboocss/types@0.8.0
  - @bamboocss/shared@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [f59154fb]
- Updated dependencies [a9c189b7]
  - @bamboocss/shared@0.7.0
  - @bamboocss/types@0.7.0

## 0.6.0

### Patch Changes

- @bamboocss/types@0.6.0
- @bamboocss/shared@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies [8c670d60]
- Updated dependencies [c0335cf4]
- Updated dependencies [762fd0c9]
- Updated dependencies [1ed239cd]
- Updated dependencies [78ed6ed4]
  - @bamboocss/types@0.5.1
  - @bamboocss/shared@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [60df9bd1]
- Updated dependencies [ead9eaa3]
  - @bamboocss/shared@0.5.0
  - @bamboocss/types@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [c7b42325]
- Updated dependencies [5b344b9c]
  - @bamboocss/types@0.4.0
  - @bamboocss/shared@0.4.0

## 0.3.2

### Patch Changes

- @bamboocss/shared@0.3.2
- @bamboocss/types@0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch
- Updated dependencies [efd79d83]
  - @bamboocss/shared@0.3.1
  - @bamboocss/types@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [6d81ee9e]
  - @bamboocss/types@0.3.0
  - @bamboocss/shared@0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

- Updated dependencies [c308e8be]
- Updated dependencies [fb40fff2]
  - @bamboocss/types@0.0.2
  - @bamboocss/shared@0.0.2
