# @bamboocss/preset-open-props

## 1.40.0

### Patch Changes

- @bamboocss/types@1.40.0

## 1.39.1

### Patch Changes

- @bamboocss/types@1.39.1

## 1.39.0

### Patch Changes

- Updated dependencies [4d27ba4]
  - @bamboocss/types@1.39.0

## 1.38.0

### Patch Changes

- @bamboocss/types@1.38.0

## 1.37.13

### Patch Changes

- @bamboocss/types@1.37.13

## 1.37.12

### Patch Changes

- @bamboocss/types@1.37.12

## 1.37.11

### Patch Changes

- @bamboocss/types@1.37.11

## 1.37.10

### Patch Changes

- @bamboocss/types@1.37.10

## 1.37.9

### Patch Changes

- @bamboocss/types@1.37.9

## 1.37.8

### Patch Changes

- @bamboocss/types@1.37.8

## 1.37.7

### Patch Changes

- @bamboocss/types@1.37.7

## 1.37.6

### Patch Changes

- @bamboocss/types@1.37.6

## 1.37.5

### Patch Changes

- @bamboocss/types@1.37.5

## 1.37.4

### Patch Changes

- @bamboocss/types@1.37.4

## 1.37.3

### Patch Changes

- @bamboocss/types@1.37.3

## 1.37.2

### Patch Changes

- @bamboocss/types@1.37.2

## 1.37.1

### Patch Changes

- @bamboocss/types@1.37.1

## 1.37.0

### Patch Changes

- @bamboocss/types@1.37.0

## 1.36.5

### Patch Changes

- @bamboocss/types@1.36.5

## 1.36.4

### Patch Changes

- @bamboocss/types@1.36.4

## 1.36.3

### Patch Changes

- @bamboocss/types@1.36.3

## 1.36.2

### Patch Changes

- @bamboocss/types@1.36.2

## 1.36.1

### Patch Changes

- @bamboocss/types@1.36.1

## 1.36.0

### Patch Changes

- @bamboocss/types@1.36.0

## 1.35.5

### Patch Changes

- @bamboocss/types@1.35.5

## 1.35.4

### Patch Changes

- @bamboocss/types@1.35.4

## 1.35.3

### Patch Changes

- @bamboocss/types@1.35.3

## 1.35.2

### Patch Changes

- @bamboocss/types@1.35.2

## 1.35.1

### Patch Changes

- @bamboocss/types@1.35.1

## 1.35.0

### Patch Changes

- Updated dependencies [9bfcf31]
  - @bamboocss/types@1.35.0

## 1.34.1

### Patch Changes

- @bamboocss/types@1.34.1

## 1.34.0

### Patch Changes

- Updated dependencies [e66c5f8]
- Updated dependencies [10bf63d]
- Updated dependencies [c49ab36]
- Updated dependencies [c527ea7]
  - @bamboocss/types@1.34.0

## 1.33.0

### Patch Changes

- Updated dependencies [f7bbc14]
  - @bamboocss/types@1.33.0

## 1.32.0

### Patch Changes

- Updated dependencies [b0ed6dc]
- Updated dependencies [8a66bb9]
- Updated dependencies [da792cc]
- Updated dependencies [1cc1860]
- Updated dependencies [c29044f]
- Updated dependencies [f3a8b0d]
- Updated dependencies [c29044f]
  - @bamboocss/types@1.32.0

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

### Patch Changes

- Updated dependencies [8fb87ac]
- Updated dependencies [8fb87ac]
- Updated dependencies [cd5954c]
- Updated dependencies [678bdee]
- Updated dependencies [774048b]
  - @bamboocss/types@1.31.0

## 1.30.1

### Patch Changes

- @bamboocss/types@1.30.1

## 1.30.0

### Patch Changes

- Updated dependencies
  - @bamboocss/types@1.30.0

## 1.29.0

### Patch Changes

- Updated dependencies [0dbe9c4]
- Updated dependencies [6114f6e]
- Updated dependencies [38393c4]
  - @bamboocss/types@1.29.0

## 1.28.1

### Patch Changes

- Updated dependencies [31749e1]
- Updated dependencies [be39dac]
  - @bamboocss/types@1.28.1

## 1.28.0

### Patch Changes

- Updated dependencies [d7fc408]
  - @bamboocss/types@1.28.0

## 1.27.0

### Patch Changes

- @bamboocss/types@1.27.0

## 1.26.0

### Patch Changes

- @bamboocss/types@1.26.0

## 1.25.0

### Patch Changes

- @bamboocss/types@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/types@1.24.0

## 1.23.0

### Patch Changes

- Updated dependencies [b041398]
  - @bamboocss/types@1.23.0

## 1.22.0

### Patch Changes

- Updated dependencies [fe62614]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
  - @bamboocss/types@1.22.0

## 1.21.0

### Patch Changes

- @bamboocss/types@1.21.0

## 1.20.4

### Patch Changes

- @bamboocss/types@1.20.4

## 1.20.3

### Patch Changes

- @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

- @bamboocss/types@1.20.1

## 1.20.0

### Patch Changes

- Updated dependencies [5d2c91c]
  - @bamboocss/types@1.20.0

## 1.19.0

### Patch Changes

- @bamboocss/types@1.19.0

## 1.18.0

### Patch Changes

- @bamboocss/types@1.18.0

## 1.17.3

### Patch Changes

- @bamboocss/types@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/types@1.17.2

## 1.17.1

### Patch Changes

- @bamboocss/types@1.17.1

## 1.17.0

### Patch Changes

- Updated dependencies [355e573]
  - @bamboocss/types@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/types@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [091f2e1]
- Updated dependencies [f2d5df2]
- Updated dependencies [1dbeb84]
- Updated dependencies [d7226f0]
- Updated dependencies [31d8577]
- Updated dependencies [2ab7f19]
- Updated dependencies [ca558fb]
  - @bamboocss/types@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/types@1.15.0

## 1.14.0

### Patch Changes

- Updated dependencies [b567114]
  - @bamboocss/types@1.14.0

## 1.13.2

### Patch Changes

- @bamboocss/types@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/types@1.13.1

## 1.13.0

### Patch Changes

- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
  - @bamboocss/types@1.13.0

## 1.12.3

### Patch Changes

- @bamboocss/types@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/types@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/types@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/types@1.12.0

## 1.11.5

### Patch Changes

- @bamboocss/types@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/types@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/types@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/types@1.11.2

## 1.11.1

### Patch Changes

- Updated dependencies [2ea9205]
  - @bamboocss/types@1.11.1

## 1.11.0

### Patch Changes

- Updated dependencies [78869ae]
  - @bamboocss/types@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [8d3b6f8]
- Updated dependencies [44457bb]
  - @bamboocss/types@1.10.0

## 1.9.1

### Patch Changes

- @bamboocss/types@1.9.1

## 1.9.0

### Patch Changes

- @bamboocss/types@1.9.0

## 1.8.2

### Patch Changes

- Updated dependencies [331d1a5]
  - @bamboocss/types@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies [3c86c29]
  - @bamboocss/types@1.8.1

## 1.8.0

### Patch Changes

- @bamboocss/types@1.8.0

## 1.7.3

### Patch Changes

- @bamboocss/types@1.7.3

## 1.7.2

### Patch Changes

- @bamboocss/types@1.7.2

## 1.7.1

### Patch Changes

- @bamboocss/types@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [86b30b1]
  - @bamboocss/types@1.7.0

## 1.6.1

### Patch Changes

- @bamboocss/types@1.6.1

## 1.6.0

### Patch Changes

- @bamboocss/types@1.6.0

## 1.5.1

### Patch Changes

- 14a6382: Update open prop preset to include new gradient, border and keyframes
  - @bamboocss/types@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies [91c65ff]
  - @bamboocss/types@1.5.0

## 1.4.3

### Patch Changes

- @bamboocss/types@1.4.3

## 1.4.2

### Patch Changes

- @bamboocss/types@1.4.2

## 1.4.1

### Patch Changes

- @bamboocss/types@1.4.1

## 1.4.0

### Patch Changes

- @bamboocss/types@1.4.0

## 1.3.1

### Patch Changes

- @bamboocss/types@1.3.1

## 1.3.0

### Patch Changes

- Updated dependencies [70efd73]
  - @bamboocss/types@1.3.0

## 1.2.0

### Patch Changes

- @bamboocss/types@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [47a0011]
- Updated dependencies [e8ec0aa]
  - @bamboocss/types@1.1.0

## 1.0.1

### Patch Changes

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
  - @bamboocss/types@1.0.0

## 0.54.0

### Patch Changes

- @bamboocss/types@0.54.0

## 0.53.7

### Patch Changes

- @bamboocss/types@0.53.7

## 0.53.6

### Patch Changes

- @bamboocss/types@0.53.6

## 0.53.5

### Patch Changes

- @bamboocss/types@0.53.5

## 0.53.4

### Patch Changes

- @bamboocss/types@0.53.4

## 0.53.3

### Patch Changes

- @bamboocss/types@0.53.3

## 0.53.2

### Patch Changes

- @bamboocss/types@0.53.2

## 0.53.1

### Patch Changes

- @bamboocss/types@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [5286731]
  - @bamboocss/types@0.53.0

## 0.52.0

### Patch Changes

- @bamboocss/types@0.52.0

## 0.51.1

### Patch Changes

- @bamboocss/types@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [d68ad1f]
  - @bamboocss/types@0.51.0

## 0.50.0

### Patch Changes

- Updated dependencies [fea78c7]
- Updated dependencies [ad89b90]
  - @bamboocss/types@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [97a0e4d]
  - @bamboocss/types@0.49.0

## 0.48.1

### Patch Changes

- @bamboocss/types@0.48.1

## 0.48.0

### Patch Changes

- @bamboocss/types@0.48.0

## 0.47.1

### Patch Changes

- @bamboocss/types@0.47.1

## 0.47.0

### Patch Changes

- Updated dependencies [5e683ee]
  - @bamboocss/types@0.47.0

## 0.46.1

### Patch Changes

- @bamboocss/types@0.46.1

## 0.46.0

### Patch Changes

- @bamboocss/types@0.46.0

## 0.45.2

### Patch Changes

- @bamboocss/types@0.45.2

## 0.45.1

### Patch Changes

- @bamboocss/types@0.45.1

## 0.45.0

### Patch Changes

- Updated dependencies [dcc9053]
  - @bamboocss/types@0.45.0

## 0.44.0

### Patch Changes

- Updated dependencies [c99cb75]
  - @bamboocss/types@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [e952f82]
  - @bamboocss/types@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [e157dd1]
- Updated dependencies [19c3a2c]
- Updated dependencies [f00ff88]
- Updated dependencies [17a1932]
  - @bamboocss/types@0.42.0

## 0.41.0

### Patch Changes

- @bamboocss/types@0.41.0

## 0.40.1

### Patch Changes

- @bamboocss/types@0.40.1

## 0.40.0

### Patch Changes

- @bamboocss/types@0.40.0

## 0.39.2

### Patch Changes

- @bamboocss/types@0.39.2

## 0.39.1

### Patch Changes

- @bamboocss/types@0.39.1

## 0.39.0

### Patch Changes

- Updated dependencies [221c9a2]
- Updated dependencies [c3e797e]
  - @bamboocss/types@0.39.0

## 0.38.0

### Patch Changes

- Updated dependencies [96b47b3]
- Updated dependencies [bc09d89]
  - @bamboocss/types@0.38.0

## 0.37.2

### Patch Changes

- Updated dependencies [74dfb3e]
  - @bamboocss/types@0.37.2

## 0.37.1

### Patch Changes

- Updated dependencies [885963c]
  - @bamboocss/types@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [bcfb5c5]
- Updated dependencies [6247dfb]
  - @bamboocss/types@0.37.0

## 0.36.1

### Patch Changes

- Updated dependencies [bd0cb07]
  - @bamboocss/types@0.36.1

## 0.36.0

### Patch Changes

- Updated dependencies [861a280]
- Updated dependencies [2691f16]
- Updated dependencies [340f4f1]
- Updated dependencies [fabdabe]
  - @bamboocss/types@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [50db354]
- Updated dependencies [f6befbf]
- Updated dependencies [a0c4d27]
  - @bamboocss/types@0.35.0

## 0.34.3

### Patch Changes

- @bamboocss/types@0.34.3

## 0.34.2

### Patch Changes

- @bamboocss/types@0.34.2

## 0.34.1

### Patch Changes

- @bamboocss/types@0.34.1

## 0.34.0

### Patch Changes

- Updated dependencies [d1516c8]
  - @bamboocss/types@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [cca50d5]
- Updated dependencies [fde37d8]
  - @bamboocss/types@0.33.0

## 0.32.1

### Patch Changes

- Updated dependencies [a032375]
- Updated dependencies [89ffb6b]
  - @bamboocss/types@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [60cace3]
- Updated dependencies [de4d9ef]
  - @bamboocss/types@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [8f36f9af]
- Updated dependencies [a17fe387]
- Updated dependencies [2d69b340]
  - @bamboocss/types@0.31.0

## 0.30.2

### Patch Changes

- Updated dependencies [6b829cab]
  - @bamboocss/types@0.30.2

## 0.30.1

### Patch Changes

- @bamboocss/types@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [74485ef1]
- Updated dependencies [ab32d1d7]
- Updated dependencies [d5977c24]
  - @bamboocss/types@0.30.0

## 0.29.1

### Patch Changes

- @bamboocss/types@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [5fcdeb75]
- Updated dependencies [250b4d11]
- Updated dependencies [a2fb5cc6]
  - @bamboocss/types@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [f58f6df2]
  - @bamboocss/types@0.28.0

## 0.27.3

### Patch Changes

- Updated dependencies [1ed4df77]
  - @bamboocss/types@0.27.3

## 0.27.2

### Patch Changes

- @bamboocss/types@0.27.2

## 0.27.1

### Patch Changes

- Updated dependencies [ee9341db]
  - @bamboocss/types@0.27.1

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

- Updated dependencies [84304901]
  - @bamboocss/types@0.27.0

## 0.26.2

### Patch Changes

- @bamboocss/types@0.26.2

## 0.26.1

### Patch Changes

- @bamboocss/types@0.26.1

## 0.26.0

### Patch Changes

- Updated dependencies [b5cf6ee6]
- Updated dependencies [58df7d74]
  - @bamboocss/types@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [59fd291c]
  - @bamboocss/types@0.25.0

## 0.24.2

### Patch Changes

- Updated dependencies [71e82a4e]
  - @bamboocss/types@0.24.2

## 0.24.1

### Patch Changes

- @bamboocss/types@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [f6881022]
  - @bamboocss/types@0.24.0

## 0.23.0

### Patch Changes

- @bamboocss/types@0.23.0

## 0.22.1

### Patch Changes

- Updated dependencies [8f4ce97c]
  - @bamboocss/types@0.22.1

## 0.22.0

### Patch Changes

- 4634df0e: Fix conditional variables in border radii
- Updated dependencies [526c6e34]
  - @bamboocss/types@0.22.0

## 0.21.0

### Patch Changes

- 05047584: Add Open Props preset
- Updated dependencies [5b061615]
- Updated dependencies [105f74ce]
  - @bamboocss/types@0.21.0
