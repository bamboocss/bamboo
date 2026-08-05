# @bamboocss/shared

## 1.13.0

### Minor Changes

- 7bf6798: Lower a single dynamic style value to a class the runtime builds by concatenation, instead of leaving a
  `css()` call behind.

  `css({ margin: '2', color: tone })` folded to `cx("m_2", css({ color: tone }))`. It now folds to
  `cx("m_2", cssLeaf("c_", "color", tone))`, where `c_` is resolved at build time and the runtime only appends the
  value. Measured against the `css()` call it replaces: 2.2x when the memo would have hit, 43x when it would have missed
  — which is every SSR render, and any value that cycles past the memo's 1000-entry ceiling.

  This is sound because `css()` already builds the class from the value alone. `utility.transform` is string
  construction over a table fixed at build time and nothing consults which rules were emitted, so `css({ color: tone })`
  already returns `c_<tone>` for a value the extractor never saw, with no CSS behind it. The lowered form produces the
  same string in the same cases.

  Three shapes do not reduce to one class and fall back to `css()` at runtime, so nothing is lost: a responsive array, a
  condition object, and any non-scalar. `null` and `undefined` produce no class, as before. A value carrying whitespace
  or `!important` still resolves correctly but takes a regex path that is slower than a memo hit, so a call whose value
  always has one is better left alone.

  It applies to a top-level property of a single-argument `css()` call, with `hash` and `cssMode: 'grouped'` declining
  automatically — neither produces a class the value is merely appended to. Condition keys are declined too, since their
  value is an object in every real use. Turn it off with `partial: false`, alongside the rest of the splitting.

  Two notes for upgrades. `cssLeaf` is emitted by the generator, so a project whose `styled-system/` was generated
  before this release must be regenerated — the transform emits an import of it, and a stale runtime has no such export.
  And `sanitize` is now exported from `@bamboocss/shared`, so the class-name pipeline has one implementation rather than
  a copy in `leafClass`.

- a5cb5a8: Add `pruneUnusedTokens`, dropping token css variables nothing can reach.

  The token layer declares every token in the theme. An app uses a fraction of them, so most of what it declares is dead
  weight in the one stylesheet that blocks first paint. On the `vite-ts` sandbox, with the default preset, this takes
  `styles.css` from 24,433 to 12,293 bytes — 6,398 to 3,504 gzipped. It scales with the size of the design system rather
  than the app: `preset-bamboo` declares 432 variables, `preset-atlaskit` 837, `preset-open-props` 898.

  It is **off by default** and changes nothing until switched on.

  A variable is kept when the generated css references it, when a kept variable's own value references it, or when it is
  named by `token()` or `token.var()` or a literal `var(--x)` anywhere under `include`. Tokens that javascript receives
  as a reference rather than a literal are always kept, because `token('colors.text')` hands the caller a `var()`
  whether or not the css mentions it. That covers virtual tokens, any token carrying a condition, and negative tokens —
  `spacing.-4` resolves to `calc(var(--spacing-4) * -1)`, so what has to survive is the _positive_ token's declaration,
  not its own. So is anything a theme refers to: a theme is a separate artifact injected at runtime, so nothing in the
  sheet points at what it needs.

  The negative-token rule is the one with a visible price, and there is no opt-out. A spacing scale generates one
  negative per entry, so the whole scale is pinned whether or not the app uses it: on the default preset an app
  referencing a single colour keeps 37 spacing variables, about a third of everything that survives. Presets with large
  spacing scales therefore see less than the numbers above.

  The walk follows any custom property, not only the removable ones. A colour palette is what forces that:
  `colorPalette: 'red'` emits `--colors-color-palette-300: var(--colors-red-300)`, and those palette properties are
  virtual, so stopping at them would leave the rule pointing at colours that had been removed.

  Two limits are deliberate:
  - Only custom properties the token system declares are eligible. `globalCss` output is never touched. `preset-base`
    declares the filter and gradient composition properties on the universal selector precisely so a parent's value
    cannot inherit into a descendant; they look unreferenced, and removing them would change rendering. The `styles.css`
    post-processing this option replaces does remove them.
  - Reachability cannot be proven for every reference. A token named by a path the source does not spell out as a string
    literal — `token.var(key)` — one used only from a stylesheet outside `include`, or one consumed by a separate
    package treating the output as design tokens, is invisible. Keep those with `staticCss`.

  Pruning runs wherever a complete stylesheet is assembled — `bamboo`, `bamboo cssgen`, watch mode and the PostCSS
  plugin — and never on a partial one such as `cssgen tokens`, where nothing would be left to reference the tokens.
  Collecting the references reads every source file, so that work stays behind the flag.

### Patch Changes

- 9ffb84f: Cache `css()` and pattern class names in the generated runtime, and stop `css.raw()` sharing a mutable
  object.

  `memo` now keys flat arguments on a structural hash confirmed by an exact comparison, falling back to `JSON.stringify`
  only for nested styles. Repeated `css()` calls get roughly 4-5x faster, multi-argument calls about 4x, and pattern
  helpers — which were not memoized at all — about 1.3x. Class name output is unchanged.

  Two behaviour changes worth knowing about:
  - The cache is now **bounded**. It previously grew for the lifetime of the process, which leaked in long-lived SSR
    workers (~16MB retained after 50k distinct styles, versus ~3MB now). The trade is that a workload whose set of
    distinct styles exceeds the bound no longer benefits from caching, and is slower than it was; a workload that reuses
    styles — the reason the cache exists — is substantially faster.
  - `css.raw()` returns a fresh object. It previously handed every caller the same cached instance, so a caller mutating
    what it received corrupted the cache and the class names produced afterwards. The copy is shallow, so mutating a
    nested condition object inside a `raw()` result still reaches shared state.

- e482ab3: Stop charging every merge for a copy only `raw()` needs.

  Merged style objects are cached, so `css.raw()` and `cva.raw()` have to hand out something independent — a caller
  mutating what it received would otherwise change what every later caller reads. That guarantee was previously supplied
  by making `mergeProps` copy nested objects, which put the cost on every merge instead of the two places that need it.

  Merging runs on every `css()` cache miss, and on every render of a pattern component under `jsxStyleProps: 'minimal'`.
  Copying there cost roughly twice as much as merging alone for a realistic style object — five base properties and four
  condition blocks — and the overhead scales with nesting, so it fell on exactly the styles people write.

  `mergeProps` is a merge again, and a new `cloneStyles` helper supplies the copy at the two boundaries where the value
  reaches user code. The independence guarantee is unchanged; the call site now says what it is doing.

  The template-literal `css.raw()` also routes through `cloneStyles`, so both syntaxes offer the same guarantee. It
  previously relied on the merge copying for it.

- 11c9409: Stop the generated runtime's memo treating differently-shaped arguments as equal.

  Cached arguments were compared as a flat bag of key/value pairs enumerated with `for...in`, which diverges from what
  the memoized functions actually read in two ways:
  - An array and an object with the same numeric keys enumerate identically, so `['x']` and `{ 0: 'x' }` shared a cache
    entry.
  - `for...in` walks the prototype chain, so an object with inherited enumerable properties was compared as though it
    owned them, while `Object.keys` and `JSON.stringify` see nothing.

  In both cases the second caller received a result computed from the first caller's arguments. No user-reachable
  miscompilation was found — style objects reaching that path are plain, and arrays of styles or responsive values are
  nested and take a different route — but the guarantee the memo documents was not one it kept, and the failure would
  surface as an inexplicable class name.

  Arrays are now distinguished from objects, and any value carrying a custom prototype is keyed by serialization
  instead, which sees exactly what the wrapped function does.

- 9ffb84f: Key scalar arguments by value in the generated runtime's memo.

  Every non-object argument hashed to the same constant, so distinct strings shared one bucket and competed for its
  fixed number of slots. Past that count the hit rate fell to zero and each call also paid a scan of the bucket and a
  fresh snapshot of its arguments.

  This hit `isCssProperty`, which is called for every prop on every render when `jsx.styleProps` is `'all'` (the
  default) and sees hundreds of distinct property names — so the hottest path in the runtime was missing its cache
  entirely.

  Scalars now hash by value, and a call with a single scalar argument is keyed directly, which is the shape of the
  callers that run most often.

- 9ffb84f: Stop `cva.raw()`, `sva.raw()` and `css.raw()` handing out shared, mutable style objects.

  Merged results are cached, so returning one directly means a caller that mutates what it received changes what every
  later caller reads:

  ```js
  const styles = button.raw({ size: 'sm' })
  styles.color = 'red' // used to poison the cached entry
  button.raw({ size: 'sm' }) // every later caller saw color: 'red'
  ```

  `css.raw()` already copied, but only at the top level, and the merge underneath kept references to the caller's nested
  objects — so a condition object such as `_hover` was shared even through that copy. Merging now copies nested objects
  and arrays instead of pointing at the source, and all three `raw()` helpers return a fully independent object.

  Class name output is unchanged.

- a966bae: Make `splitProps` faster by reading each key's descriptor instead of building one for the whole object, and
  by answering key membership from the own-keys list rather than by asking the object per key.

  Roughly 2.4–2.9x on plain and frozen props, 1.2x on accessor props, and about even on the proxy Solid's `mergeProps`
  hands over — the shapes that carry something to preserve keep the descriptor path and most of its cost.

  It called `Object.getOwnPropertyDescriptors` up front and `Object.defineProperty` for every key it moved. That is paid
  once per element per render, and the descriptor path is only needed for keys that have something to preserve.

  An accessor still stays an accessor — Solid compiles props to accessors, and reading one during a split would build a
  component's children before their provider exists — a non-enumerable key stays non-enumerable, and `__proto__` is
  defined rather than assigned so it stays an own property.

  One thing does change: a key taken from frozen props — React freezes them in development — arrives writable, because
  `writable`/`configurable` are carried over only on the descriptor path. Assigning to a split bucket used to throw in
  strict mode and now succeeds. Nothing in the framework mutates one.

  Two long-standing bugs go with it: a group naming `toString`, `constructor` or another `Object.prototype` member used
  to be handed one and put `undefined` in its bucket, and that spurious key also reached the rest bucket.

## 1.12.3

## 1.12.2

## 1.12.1

## 1.12.0

## 1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown

## 1.11.1

## 1.11.0

## 1.10.0

### Patch Changes

- c31f3a2: Improve error handling architecture across all packages.
- 44457bb: Use TypeScript 6.0 or later with Bamboo. This release updates static analysis and codegen to ts-morph v28 and
  TypeScript 6.0.2.

## 1.9.1

## 1.9.0

## 1.8.2

## 1.8.1

## 1.8.0

## 1.7.3

## 1.7.2

## 1.7.1

## 1.7.0

## 1.6.1

## 1.6.0

## 1.5.1

## 1.5.0

## 1.4.3

## 1.4.2

### Patch Changes

- 1290a27: Only log errors that are instances of `BambooError`, preventing test framework and other non-Bamboo errors
  from being logged during development.

## 1.4.1

## 1.4.0

## 1.3.1

## 1.3.0

## 1.2.0

## 1.1.0

### Minor Changes

- e8ec0aa: Add support for `preset:resolved` hook to pick/omit specific preset properties.

## 1.0.1

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

## 0.54.0

### Patch Changes

- efa060d: Improve algorithm for deterministic property order.
  - Longhand (`padding`, `margin`, `inset`)
  - Shorthand of longhands (`padding-inline`, `margin-inline`)
  - Shorthand of shorthands (`padding-inline-start`, `margin-inline-start`)

  ```tsx
  css({
    p: '4',
    pr: '2',
    px: '10',
  })
  ```

  Will result in the following css regardless of the order of the properties:

  ```css
  .p-4 {
    padding: 4px;
  }

  .px-10 {
    padding-left: 10px;
    padding-right: 10px;
  }

  .pr-2 {
    padding-right: 2px;
  }
  ```

- d2aede5: Reduce the size of the generated `Token` type by referencing category tokens.

  **Before:**

  ```ts
  export type Token = 'colors.green.400' | 'colors.red.400'

  export type ColorToken = 'green.400' | 'red.400'
  ```

  **After:**

  ```ts
  export type Token = `colors.${ColorToken}`

  export type ColorToken = 'green.400' | 'red.400'
  ```

## 0.53.7

## 0.53.6

## 0.53.5

## 0.53.4

## 0.53.3

## 0.53.2

## 0.53.1

## 0.53.0

## 0.52.0

## 0.51.1

## 0.51.0

## 0.50.0

## 0.49.0

## 0.48.1

## 0.48.0

## 0.47.1

## 0.47.0

## 0.46.1

## 0.46.0

### Minor Changes

- 54426a2: Add support native css nesting in template literal mode. Prior to this change, you need to add `&` to all
  nested selectors.

  Before:

  ```ts
  css`
    & p {
      color: red;
    }
  `
  ```

  After:

  ```ts
  css`
    p {
      color: red;
    }
  `
  ```

  > **Good to know**: Internally, this will still convert to `p` to `& p`, but the generated css will work as expected.

## 0.45.2

## 0.45.1

## 0.45.0

### Patch Changes

- 552dd4b: Fix issue where `divideY` and `divideColor` utilities, used together in a recipe, doesn't generate the
  correct css.

## 0.44.0

## 0.43.0

## 0.42.0

## 0.41.0

## 0.40.1

## 0.40.0

## 0.39.2

### Patch Changes

- 1f636eb: Fix a cache issue that leads to HMR growing slower in some cases

## 0.39.1

## 0.39.0

### Patch Changes

- 935ec86: Allow passing arrays of `SystemStyleObject` to the `css(xxx, [aaa, bbb, ccc], yyy)` fn

  This is useful when you are creating your own styled component and want to benefit
  [from the recent `css` array property support](https://github.com/bamboocss/bamboo/pull/2515).

  ```diff
  import { css } from 'styled-system/css'
  import type { HTMLStyledProps } from 'styled-system/types'

  type ButtonProps = HTMLStyledProps<'button'>

  export const Button = ({ css: cssProp = {}, children }: ButtonProps) => {
  -  const className = css(...(Array.isArray(cssProp) ? cssProp : [cssProp]))
  +  const className = css(cssProp)
    return <button className={className}>{children}</button>
  }
  ```

## 0.38.0

### Minor Changes

- 2c8b933: Add least resource used (LRU) cache in the hot parts to prevent memory from growing infinitely

## 0.37.2

## 0.37.1

### Patch Changes

- 99870bb: Fix issue where setting the pattern `jsx` option with dot notation didn't work.

  ```jsx
  import { defineConfig } from '@bamboocss/dev'

  export default defineConfig({
    // ...
    patterns: {
      extend: {
        grid: {
          jsx: ['Form.Group', 'Grid'],
        },
        stack: {
          jsx: ['Form.Action', 'Stack'],
        },
      },
    },
  })
  ```

## 0.37.0

### Patch Changes

- 7daf159: Fix a bug where some styles would be grouped together in the same rule, even if they were not related to each
  other.

  ## Internal details

  This was caused by an object reference being re-used while setting a property deeply in the hashes decoding process,
  leading to the mutation of a previous style object with additional properties.

## 0.36.1

## 0.36.0

## 0.35.0

## 0.34.3

## 0.34.2

## 0.34.1

## 0.34.0

## 0.33.0

## 0.32.1

## 0.32.0

### Patch Changes

- 8cd8c19: Always sort `all` to be first, so that other properties can easily override it

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

## 0.30.2

## 0.30.1

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

## 0.29.0

## 0.28.0

### Patch Changes

- 770c7aa4: Update `getArbitraryValue` so it works for values that start on a new line

## 0.27.3

## 0.27.2

## 0.27.1

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

- 74ac0d9d: Improve the performance of the runtime transform functions by caching their results (css, cva, sva,
  recipe/slot recipe, patterns)

  > See detailed breakdown of the performance improvements
  > [here](https://github.com/bamboocss/bamboo/pull/1986#issuecomment-1887459483) based on the React Profiler.

## 0.26.2

## 0.26.1

## 0.26.0

### Patch Changes

- 657ca5da: Fix issue where `[]` escape hatch clashed with named grid lines

## 0.25.0

## 0.24.2

### Patch Changes

- 71e82a4e: Fix a regression with utility where boolean values would be treated as a string, resulting in "false" being
  seen as a truthy value

## 0.24.1

## 0.24.0

## 0.23.0

## 0.22.1

### Patch Changes

- 647f05c9: Fix a CSS generation issue with `config.strictTokens` when using the `[xxx]` escape-hatch syntax with `!` or
  `!important`

  ```ts
  css({
    borderWidth: '[2px!]',
    width: '[2px !important]',
  })
  ```

## 0.22.0

### Patch Changes

- 8db47ec6: Fix issue where array syntax did not generate reponsive values in mapped pattern properties

## 0.21.0

### Minor Changes

- 26e6051a: Add an escape-hatch for arbitrary values when using `config.strictTokens`, by prefixing the value with `[`
  and suffixing with `]`, e.g. writing `[123px]` as a value will bypass the token validation.

  ```ts
  import { css } from '../styled-system/css'

  css({
    // @ts-expect-error TS will throw when using from strictTokens: true
    color: '#fff',
    // @ts-expect-error TS will throw when using from strictTokens: true
    width: '100px',

    // ✅ but this is now allowed:
    bgColor: '[rgb(51 155 240)]',
    fontSize: '[12px]',
  })
  ```

## 0.20.1

## 0.20.0

## 0.19.0

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

### Patch Changes

- ba9e32fa: Fix issue in template literal mode where comma-separated selectors don't work when multiline

## 0.17.5

## 0.17.4

## 0.17.3

## 0.17.2

## 0.17.1

### Patch Changes

- 5ce359f6: Fix issue where styled objects are sometimes incorrectly merged, leading to extraneous classnames in the DOM

## 0.17.0

### Minor Changes

- 12281ff8: Improve support for styled element composition. This ensures that you can compose two styled elements
  together and the styles will be merged correctly.

  ```jsx
  const Box = styled('div', {
    base: {
      background: 'red.light',
      color: 'white',
    },
  })

  const ExtendedBox = styled(Box, {
    base: { background: 'red.dark' },
  })

  // <ExtendedBox> will have a background of `red.dark` and a color of `white`
  ```

  **Limitation:** This feature does not allow compose mixed styled composition. A mixed styled composition happens when
  an element is created from a cva/inline cva, and another created from a config recipe.
  - CVA or Inline CVA + CVA or Inline CVA = ✅
  - Config Recipe + Config Recipe = ✅
  - CVA or Inline CVA + Config Recipe = ❌

  ```jsx
  import { button } from '../styled-system/recipes'

  const Button = styled('div', button)

  // ❌ This will throw an error
  const ExtendedButton = styled(Button, {
    base: { background: 'red.dark' },
  })
  ```

## 0.16.0

## 0.15.5

## 0.15.4

## 0.15.3

### Patch Changes

- 95b06bb1: Fix issue in template literal mode where media queries doesn't work

## 0.15.2

## 0.15.1

### Patch Changes

- 26f6982c: Fix issue where slot recipe breaks when `slots` is `undefined`

## 0.15.0

### Patch Changes

- 9f429d35: Fix issue where slot recipe did not apply rules when variant name has the same key as a slot
- f27146d6: Fix an issue where some JSX components wouldn't get matched to their corresponding recipes/patterns when
  using `Regex` in the `jsx` field of a config, resulting in some style props missing.

  issue: https://github.com/bamboocss/bamboo/issues/1315

## 0.14.0

## 0.13.1

## 0.13.0

## 0.12.2

## 0.12.1

## 0.12.0

## 0.11.1

### Patch Changes

- c07e1beb: Make the `cx` smarter by merging and deduplicating the styles passed in

  Example:

  ```tsx
  <h1 className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>Will result in "mx_10 pt_6"</h1>
  ```

## 0.11.0

## 0.10.0

### Minor Changes

- a669f4d5: Introduce new slot recipe features.

  Slot recipes are useful for styling composite or multi-part components easily.
  - `sva`: the slot recipe version of `cva`
  - `defineSlotRecipe`: the slot recipe version of `defineRecipe`

  **Definition**

  ```jsx
  import { sva } from 'styled-system/css'

  const button = sva({
    slots: ['label', 'icon'],
    base: {
      label: { color: 'red', textDecoration: 'underline' },
    },
    variants: {
      rounded: {
        true: {},
      },
      size: {
        sm: {
          label: { fontSize: 'sm' },
          icon: { fontSize: 'sm' },
        },
        lg: {
          label: { fontSize: 'lg' },
          icon: { fontSize: 'lg', color: 'pink' },
        },
      },
    },
    defaultVariants: {
      size: 'sm',
    },
  })
  ```

  **Usage**

  ```jsx
  export function App() {
    const btnClass = button({ size: 'lg', rounded: true })

    return (
      <button>
        <p class={btnClass.label}> Label</p>
        <p class={btnClass.icon}> Icon</p>
      </button>
    )
  }
  ```

### Patch Changes

- 24e783b3: Reduce the overall `outdir` size, introduce the new config `jsxStyleProps` option to disable style props and
  further reduce it.

  `config.jsxStyleProps`:
  - When set to 'all', all style props are allowed.
  - When set to 'minimal', only the `css` prop is allowed.
  - When set to 'none', no style props are allowed and therefore the `jsxFactory` will not be usable as a component:
    - `<styled.div />` and `styled("div")` aren't valid
    - but the recipe usage is still valid `styled("div", { base: { color: "red.300" }, variants: { ...} })`

## 0.9.0

## 0.8.0

## 0.7.0

### Patch Changes

- f59154fb: Fix issue where slash could not be used in token name

## 0.6.0

## 0.5.1

### Patch Changes

- c0335cf4: Fix the `astish` shared function when using `config.syntax: 'template-literal'`

  ex: css`${someVar}`

  if a value is unresolvable in the static analysis step, it would be interpreted as `undefined`, and `astish` would
  throw:

  > TypeError: Cannot read properties of undefined (reading 'replace')

- 762fd0c9: Fix issue where the `walkObject` shared helper would set an object key to a nullish value

  Example:

  ```ts
  const shorthands = {
    flexDir: 'flexDirection',
  }

  const obj = {
    flexDir: 'row',
    flexDirection: undefined,
  }

  const result = walkObject(obj, (value) => value, {
    getKey(prop) {
      return shorthands[prop] ?? prop
    },
  })
  ```

  This would set the `flexDirection` to `row` (using `getKey`) and then set the `flexDirection` property again, this
  time to `undefined`, since it existed in the original object

## 0.5.0

### Minor Changes

- ead9eaa3: Add support for tagged template literal version.

  This features is pure css approach to writing styles, and can be a great way to migrate from styled-components and
  emotion.

  Set the `syntax` option to `template-literal` in the bamboo config to enable this feature.

  ```js
  // bamboo.config.ts
  export default defineConfig({
    //...
    syntax: 'template-literal',
  })
  ```

  > For existing projects, you might need to run the `bamboo codegen --clean`

  You can also use the `--syntax` option to specify the syntax type when using the CLI.

  ```sh
  bamboo init -p --syntax template-literal
  ```

  To get autocomplete for token variables, consider using the
  [CSS Var Autocomplete](https://marketplace.visualstudio.com/items?itemName=phoenisx.cssvar) extension.

### Patch Changes

- 60df9bd1: Fix issue where escaping classname doesn't work when class starts with number.

## 0.4.0

## 0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch

## 0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.

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

- 49c760cd: Fix issue where responsive array in css and cva doesn't generate the correct classname

## 0.29.1

## 0.29.0

## 0.28.0

### Patch Changes

- 770c7aa4: Update `getArbitraryValue` so it works for values that start on a new line

## 0.27.3

## 0.27.2

## 0.27.1

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

- 74ac0d9d: Improve the performance of the runtime transform functions by caching their results (css, cva, sva,
  recipe/slot recipe, patterns)

  > See detailed breakdown of the performance improvements
  > [here](https://github.com/bamboocss/bamboo/pull/1986#issuecomment-1887459483) based on the React Profiler.

## 0.26.2

## 0.26.1

## 0.26.0

### Patch Changes

- 657ca5da: Fix issue where `[]` escape hatch clashed with named grid lines

## 0.25.0

## 0.24.2

### Patch Changes

- 71e82a4e: Fix a regression with utility where boolean values would be treated as a string, resulting in "false" being
  seen as a truthy value

## 0.24.1

## 0.24.0

## 0.23.0

## 0.22.1

### Patch Changes

- 647f05c9: Fix a CSS generation issue with `config.strictTokens` when using the `[xxx]` escape-hatch syntax with `!` or
  `!important`

  ```ts
  css({
    borderWidth: '[2px!]',
    width: '[2px !important]',
  })
  ```

## 0.22.0

### Patch Changes

- 8db47ec6: Fix issue where array syntax did not generate reponsive values in mapped pattern properties

## 0.21.0

### Minor Changes

- 26e6051a: Add an escape-hatch for arbitrary values when using `config.strictTokens`, by prefixing the value with `[`
  and suffixing with `]`, e.g. writing `[123px]` as a value will bypass the token validation.

  ```ts
  import { css } from '../styled-system/css'

  css({
    // @ts-expect-error TS will throw when using from strictTokens: true
    color: '#fff',
    // @ts-expect-error TS will throw when using from strictTokens: true
    width: '100px',

    // ✅ but this is now allowed:
    bgColor: '[rgb(51 155 240)]',
    fontSize: '[12px]',
  })
  ```

## 0.20.1

## 0.20.0

## 0.19.0

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

### Patch Changes

- ba9e32fa: Fix issue in template literal mode where comma-separated selectors don't work when multiline

## 0.17.5

## 0.17.4

## 0.17.3

## 0.17.2

## 0.17.1

### Patch Changes

- 5ce359f6: Fix issue where styled objects are sometimes incorrectly merged, leading to extraneous classnames in the DOM

## 0.17.0

### Minor Changes

- 12281ff8: Improve support for styled element composition. This ensures that you can compose two styled elements
  together and the styles will be merged correctly.

  ```jsx
  const Box = styled('div', {
    base: {
      background: 'red.light',
      color: 'white',
    },
  })

  const ExtendedBox = styled(Box, {
    base: { background: 'red.dark' },
  })

  // <ExtendedBox> will have a background of `red.dark` and a color of `white`
  ```

  **Limitation:** This feature does not allow compose mixed styled composition. A mixed styled composition happens when
  an element is created from a cva/inline cva, and another created from a config recipe.
  - CVA or Inline CVA + CVA or Inline CVA = ✅
  - Config Recipe + Config Recipe = ✅
  - CVA or Inline CVA + Config Recipe = ❌

  ```jsx
  import { button } from '../styled-system/recipes'

  const Button = styled('div', button)

  // ❌ This will throw an error
  const ExtendedButton = styled(Button, {
    base: { background: 'red.dark' },
  })
  ```

## 0.16.0

## 0.15.5

## 0.15.4

## 0.15.3

### Patch Changes

- 95b06bb1: Fix issue in template literal mode where media queries doesn't work

## 0.15.2

## 0.15.1

### Patch Changes

- 26f6982c: Fix issue where slot recipe breaks when `slots` is `undefined`

## 0.15.0

### Patch Changes

- 9f429d35: Fix issue where slot recipe did not apply rules when variant name has the same key as a slot
- f27146d6: Fix an issue where some JSX components wouldn't get matched to their corresponding recipes/patterns when
  using `Regex` in the `jsx` field of a config, resulting in some style props missing.

  issue: https://github.com/bamboocss/bamboo/issues/1315

## 0.14.0

## 0.13.1

## 0.13.0

## 0.12.2

## 0.12.1

## 0.12.0

## 0.11.1

### Patch Changes

- c07e1beb: Make the `cx` smarter by merging and deduplicating the styles passed in

  Example:

  ```tsx
  <h1 className={cx(css({ mx: '3', paddingTop: '4' }), css({ mx: '10', pt: '6' }))}>Will result in "mx_10 pt_6"</h1>
  ```

## 0.11.0

## 0.10.0

### Minor Changes

- a669f4d5: Introduce new slot recipe features.

  Slot recipes are useful for styling composite or multi-part components easily.
  - `sva`: the slot recipe version of `cva`
  - `defineSlotRecipe`: the slot recipe version of `defineRecipe`

  **Definition**

  ```jsx
  import { sva } from 'styled-system/css'

  const button = sva({
    slots: ['label', 'icon'],
    base: {
      label: { color: 'red', textDecoration: 'underline' },
    },
    variants: {
      rounded: {
        true: {},
      },
      size: {
        sm: {
          label: { fontSize: 'sm' },
          icon: { fontSize: 'sm' },
        },
        lg: {
          label: { fontSize: 'lg' },
          icon: { fontSize: 'lg', color: 'pink' },
        },
      },
    },
    defaultVariants: {
      size: 'sm',
    },
  })
  ```

  **Usage**

  ```jsx
  export function App() {
    const btnClass = button({ size: 'lg', rounded: true })

    return (
      <button>
        <p class={btnClass.label}> Label</p>
        <p class={btnClass.icon}> Icon</p>
      </button>
    )
  }
  ```

### Patch Changes

- 24e783b3: Reduce the overall `outdir` size, introduce the new config `jsxStyleProps` option to disable style props and
  further reduce it.

  `config.jsxStyleProps`:
  - When set to 'all', all style props are allowed.
  - When set to 'minimal', only the `css` prop is allowed.
  - When set to 'none', no style props are allowed and therefore the `jsxFactory` will not be usable as a component:
    - `<styled.div />` and `styled("div")` aren't valid
    - but the recipe usage is still valid `styled("div", { base: { color: "red.300" }, variants: { ...} })`

## 0.9.0

## 0.8.0

## 0.7.0

### Patch Changes

- f59154fb: Fix issue where slash could not be used in token name

## 0.6.0

## 0.5.1

### Patch Changes

- c0335cf4: Fix the `astish` shared function when using `config.syntax: 'template-literal'`

  ex: css`${someVar}`

  if a value is unresolvable in the static analysis step, it would be interpreted as `undefined`, and `astish` would
  throw:

  > TypeError: Cannot read properties of undefined (reading 'replace')

- 762fd0c9: Fix issue where the `walkObject` shared helper would set an object key to a nullish value

  Example:

  ```ts
  const shorthands = {
    flexDir: 'flexDirection',
  }

  const obj = {
    flexDir: 'row',
    flexDirection: undefined,
  }

  const result = walkObject(obj, (value) => value, {
    getKey(prop) {
      return shorthands[prop] ?? prop
    },
  })
  ```

  This would set the `flexDirection` to `row` (using `getKey`) and then set the `flexDirection` property again, this
  time to `undefined`, since it existed in the original object

## 0.5.0

### Minor Changes

- ead9eaa3: Add support for tagged template literal version.

  This features is pure css approach to writing styles, and can be a great way to migrate from styled-components and
  emotion.

  Set the `syntax` option to `template-literal` in the bamboo config to enable this feature.

  ```js
  // bamboo.config.ts
  export default defineConfig({
    //...
    syntax: 'template-literal',
  })
  ```

  > For existing projects, you might need to run the `bamboo codegen --clean`

  You can also use the `--syntax` option to specify the syntax type when using the CLI.

  ```sh
  bamboo init -p --syntax template-literal
  ```

  To get autocomplete for token variables, consider using the
  [CSS Var Autocomplete](https://marketplace.visualstudio.com/items?itemName=phoenisx.cssvar) extension.

### Patch Changes

- 60df9bd1: Fix issue where escaping classname doesn't work when class starts with number.

## 0.4.0

## 0.3.2

## 0.3.1

### Patch Changes

- efd79d83: Baseline release for the launch

## 0.3.0

## 0.0.2

### Patch Changes

- fb40fff2: Initial release of all packages
  - Internal AST parser for TS and TSX
  - Support for defining presets in config
  - Support for design tokens (core and semantic)
  - Add `outExtension` key to config to allow file extension options for generated javascript. `.js` or `.mjs`
  - Add `jsxElement` option to patterns, to allow specifying the jsx element rendered by the patterns.
