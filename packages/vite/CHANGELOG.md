# @bamboocss/vite

## 1.13.1

### Patch Changes

- @bamboocss/config@1.13.1
- @bamboocss/core@1.13.1
- @bamboocss/extractor@1.13.1
- @bamboocss/logger@1.13.1
- @bamboocss/node@1.13.1
- @bamboocss/shared@1.13.1
- @bamboocss/types@1.13.1

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

- 6fccbd9: Lower a ternary style value to a ternary between two class literals, instead of leaving the property to the
  runtime.
  - `css({ margin: '2', color: isError ? 'red.500' : 'green.500' })` now folds to
    `cx('m_2', isError ? 'c_red.500' : 'c_green.500')`, removing the `css()` call entirely when nothing else is dynamic.
  - Independent conditionals stay linear: two of them emit two ternaries, not four combinations.
  - Declined when a branch does not resolve, when two ternaries would emit a class for the same property, when the
    conditional was written somewhere other than the call site, and when hoisting the condition would reorder it against
    a dynamic value beside it. A declined lowering sends its property back to the runtime call rather than giving up the
    split, so the static half is still hoisted.
  - `FoldedCall` gains `classNames`, listing every class literal the rewrite emits including both arms of each ternary.
    `className` continues to hold only the part resolved outright, which is empty when a call lowered entirely.

- 2dda723: Fold a `styled.*` element that carries a runtime `className`.

  `<styled.div color="red.300" className={cn} />` kept its factory because a dynamic class could not be concatenated
  into a literal. The split already emits a `cx` call, so it becomes `<div className={cx("c_red.300", cn)} />` — with
  `cn` last, which is where the factory's own `cx(styles, props.className)` put it, so a class it carries still wins the
  way it did before.

  This is the most common reason a reusable component declined, since forwarding `className` is how one is usually made
  composable. Rendering fifty trees of such elements: 4.45x.

  It has to be emitted last for the cascade and first for evaluation order, so a `className` declines when something
  written after it survives the fold and could observe the swap. The test is two-sided, because `A;B` becoming `B;A`
  shows as soon as `A` writes what `B` reads: a constant commutes with anything, while an expression that only reads
  commutes only while the `className` cannot write. So `className={cn} onClick={h}` folds, `className={cn} id="x"`
  folds, and `className={assigns()} bg={tone}` does not. A static style prop is exempt either way, being resolved rather
  than emitted. A `className` written twice declines unless both are static, where the later simply overwrites as it
  does at runtime.

  An element with no style props at all now folds to `cx(cn)` rather than keeping a factory that had nothing to do.

  Build time is unchanged on modules where nothing folds. Two per-file scans the helper resolution runs — the module
  specifiers and the module-scope names — are now memoized against the file's text rather than repeated per element,
  which removes a superlinear term predating this change: folding 600 elements went from 317ms to 39ms. A residual term
  remains, since the declarations themselves are still walked per element.

- e7aeced: Lower a runtime-valued style prop on a `styled.*` element, instead of sending it to a `css()` call.

  `<styled.div color="red.300" backgroundColor={tone} />` folded to `cx("c_red.300", css({ backgroundColor: tone }))`.
  It now folds to `cx("c_red.300", cssLeaf("bg-c_", "backgroundColor", tone))`, the same lowering the call-site split
  already did.

  An element whose props are _all_ runtime-valued now folds too, where it previously kept its factory for want of a
  static half to hoist. That is the case where the factory was pure overhead, since no static class amortised it.

  Rendering fifty trees of runtime-valued props goes from 1.58x to 2.86x against the unfolded source, and the fixture's
  `styled.*` elements drop from 6 to 1 with its `css()` calls from 1 to 0. A mixed tree is unchanged at 3.2x, since
  little of it reaches this path.

  Two rules narrow it, both about a `css()` object being last-wins where separate classes are not. Two props claiming
  one property — `mx` and `marginInline` — are never lowered apart. And lowered props may sit before or after what stays
  behind, but not interleave with it, since splitting the residue into two calls would turn one merge into two.

- e98339a: Fold a `styled.*` or pattern element that carries `ref`, `key` or an explicit `children` prop, under React.

  All three were declined alongside `unstyled` and `css`, but unlike those two they change nothing about how the element
  is styled — so the fold was refusing them for the company they kept.

  `<styled.div ref={r} color="red.300" />` becomes `<div ref={r} className={"c_red.300"} />`. React's factory forwards
  the ref to the element it renders, so moving it onto that element changes nothing — verified against a real DOM for
  object refs, callback refs, React 19 cleanup functions, detach on unmount, and `as` naming a component that does and
  does not forward.

  React only, and measured rather than reasoned about. Preact was included at first because its factory wraps in
  `forwardRef` too, and that inference was wrong: an unfolded `ref` there binds the component instance while a folded
  one binds the DOM node. Vue diverges for the plain reason — a ref on a component is the instance, on an element it is
  the node. Every other framework keeps the behaviour it had.

  `key` never reaches the component, React consuming it for reconciliation. An explicit `children` prop declines when
  the target is not an intrinsic tag: the factory's `children ?? combinedProps.children` collapses `null` to
  `undefined`, so a destructuring default fires where the folded `children={null}` would not.

  Each travels as a passthrough, so the ordering rules already in place apply — `className={writes()} ref={r}` declines,
  because the ref read would move behind the write.

  Two things this also closes on the pattern path. A `jsxElement` that is not an intrinsic tag now declines rather than
  folding: the runtime hands it to `createElement` as a string, so `jsxElement: 'Section'` folded to `<Section />`,
  which is a variable reference and threw at render. And `foo.bar` folded to a member expression naming something in
  scope.

  `unstyled` and a `css` prop still decline. Those two do change the styling: one skips the recipe, the other merges
  above the style props.

  No build-time cost either way. The per-element check is the same set lookup; elements that previously bailed at it now
  run the rest of the loop and fold, which is the point.

- a24d37a: Add `@bamboocss/vite`, with opt-in build-time source transformation.

  During a production build the plugin rewrites statically-resolvable `css()` and pattern calls into the class string
  they would have returned, so those calls cost nothing at runtime:

  ```tsx
  // you write
  export const title = css({ fontSize: 'lg', fontWeight: 'bold' })

  // the bundle gets
  export const title = 'fs_lg fw_bold'
  ```

  CSS output is unchanged — only the JavaScript changes. It is **off by default** and build-only:

  ```ts
  // vite.config.ts
  import bamboocss from '@bamboocss/vite'

  export default defineConfig({
    plugins: [bamboocss({ transform: true })],
  })
  ```

  The plugin does not emit CSS. Keep your existing PostCSS setup for that.

  `styled.*` elements collapse to the intrinsic tag they render, which is where most style resolution happens at runtime
  — the factory runs `splitProps`, `css()` and `cx` per element per render inside a `forwardRef`:

  ```tsx
  <styled.div color="red.300" onClick={fn}>hi</styled.div>
  <div onClick={fn} className={"c_red.300"}>hi</div>
  ```

  Props follow the factory's own rule: with no recipe attached, css properties are consumed and everything else reaches
  the DOM unchanged. Elements carrying `as`, `unstyled`, `css`, `ref`, a spread, a dynamic prop or an `html*` prop are
  left alone. Pass `jsx: false` for call-site folding only.

  A `styled.*` element with a static `as` folds to that tag, pattern elements (`<Stack>`) collapse the pattern and the
  factory together, and a call or element that is only _partly_ static splits — the resolvable half becomes a literal
  and the rest keeps its runtime call, joined with `cx`. Splitting is refused wherever the two halves could produce a
  class for the same property. Pass `partial: false` to disable it.

  Values composed across files fold too, since the extractor already resolves them — an imported `css.raw()` value, a
  plain exported object, an aliased import, or a pure local helper including an IIFE. When a fold reads from another
  module the plugin registers it as a watch dependency, so editing that module re-transforms its consumers instead of
  leaving a stale literal behind.

  Only fully static call sites fold. Anything else is left byte-identical: runtime values, ternaries, computed keys,
  spreads of anything but an inline object literal, and calls where any one argument is dynamic. `css.raw()` and the
  other `.raw()` variants never fold because they must keep returning a style object; `cva()`, `sva()`, and `token()`
  never fold because they do not evaluate to a class string. Set `reportSkipped: true` to have every declined call
  reported with a reason.

  Folded strings are computed through the same runtime `css` the app would have called, rebuilt in-process from the
  resolved config, so the substitution is behaviour-preserving by construction. Every folded class is separately
  asserted to be backed by a rule in the emitted CSS.

  Where this pays off: a cache miss costs ~3.1µs against ~66ns warm, and nested styles never reach the fast memoization
  path — a component with a condition and a responsive value costs ~437ns per call even fully cached. Folding removes
  that work rather than caching it. The runtime itself still ships, since dropping it would require every call site in
  the module graph to fold.

  Build only. Folding re-parses each module with `ts-morph` — measured at ~0.3ms for a small component and ~3ms for a
  147-line file with 24 call sites on `sandbox/vite-ts`, with the parse dominating and the fold adding ~10% on top. That
  amortizes across a build; on every hot update it would not, and a dev bundle gains nothing from pre-resolved style
  calls.

  Also scopes `RuleProcessor`'s `css`/`grouped`/`cva`/`sva`/`recipe` results to the call that produced them. They
  previously reported every class name the decoder had accumulated, which is correct for a processor used once and wrong
  for one shared across call sites. No change to CSS output or to any single-call result.

### Patch Changes

- d6e55ed: Decide whether the fold can add its `cx` import without binding the whole program.

  The check went through `sourceFile.getLocals()`, which reaches the compiler's symbol table and binds every `.d.ts` the
  module's imports touch. A syntactic walk of the module's statements answers the same question. Fold-only cost for a
  module that splits, A/B on an idle machine:

  | project size | before  | after  |
  | ------------ | ------- | ------ |
  | ~500 files   | 5.28ms  | 0.06ms |
  | ~2500 files  | 11.57ms | 0.07ms |

  85x at 500 files and 178x at 2500, and flat in project size where it previously grew linearly.

  The walk follows statements but not function or class bodies, since those open a new variable scope — so a hoisted
  `var` in any top-level block still blocks the insert, while one inside a function does not.

- 7a9413f: Stop folding a choice the extractor could not decide.

  The extractor answers "what styles could this produce", so when one arm of `a ? b : c`, `a || b` or `a && b` does not
  evaluate it returns the other rather than refusing. That is right for generating CSS and wrong for rewriting source,
  where the arm it kept becomes the only one that runs.
  - `css({ color: e ? 'red.300' : fn() })` folded to `c_red.300`, silently choosing a branch. Same for
    `fn() || 'blue.500'`, `fn() && 'blue.500'`, `on && fn()` with a truthy `on`, and `empty || 'blue.500'` with a falsy
    `empty`.
  - A choice with two resolvable arms still folds, including through named values and comparison conditions.
  - A nested object reached by name — `css({ _hover: base })` or the `css({ _hover })` shorthand — is now checked where
    it was written, so a spread or computed key inside the declaration is no longer invisible. An object passed as the
    whole argument, `css(base)`, is not yet: the extractor rebuilds that map against the call itself, leaving no
    declaration to follow.
  - A chain of short-circuits is judged all the way down, within the expression written at the call site.
    `fn() || 'red.300' || 'blue.500'` parses as `(fn() || 'red.300') || 'blue.500'`, so the outer operator was handed an
    arm the extractor had invented and read it as an ordinary literal. A choice reached through a _binding_ is still not
    judged — `const c = fn() || 'red.300'` followed by `css({ color: c })` folds to `c_red.300`.
  - A comparison is no longer folded to one of its operands. `css({ color: fn() === 'red.300' })` gave `c_red.300` and
    `css({ truncate: false === false })` gave `trunc_false`, where the value is `true`. The extractor collapses `===`,
    `in`, `instanceof` and the ordering operators the same way it collapses a choice, and never computes the comparison,
    so no answer it can give is the result.
  - A short-circuit folds only when its left operand is written at the call site. A box reached through a name records
    the declaration the extractor resolved through — `let m = '1'; m = undefined` still boxes as `'1'`, and a parameter
    default still boxes as its default for a caller that passed something else — and truthiness is exactly what that
    changes. So `const c = 'red.300'; css({ color: c || 'blue.500' })` no longer folds, while writing the value inline
    still does.

- Updated dependencies [9ffb84f]
- Updated dependencies [e482ab3]
- Updated dependencies [5b881ee]
- Updated dependencies [7bf6798]
- Updated dependencies [328a926]
- Updated dependencies [11c9409]
- Updated dependencies [9ffb84f]
- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [9ffb84f]
- Updated dependencies [d7825f6]
- Updated dependencies [a966bae]
- Updated dependencies [5b16a67]
- Updated dependencies [a24d37a]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
  - @bamboocss/shared@1.13.0
  - @bamboocss/extractor@1.13.0
  - @bamboocss/types@1.13.0
  - @bamboocss/core@1.13.0
  - @bamboocss/node@1.13.0
  - @bamboocss/config@1.13.0
  - @bamboocss/logger@1.13.0
