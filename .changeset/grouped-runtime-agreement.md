---
'@bamboocss/generator': patch
'@bamboocss/parser': patch
'@bamboocss/core': patch
'@bamboocss/vite': patch
---

Fix four of the ways `cssMode: 'grouped'` returned class names the build emitted no rule for.

A grouped class names a whole `css()` call, so the build and the runtime have to agree on which object that call
resolves to. Where they disagreed the failure was silent and total — the element rendered with no styles at all, not
merely the wrong ones. Now fixed:

- **Patterns** (`stack({ gap: '4' })`) and their JSX form were extracted one class per property while the runtime hashed
  the transformed object as a group. They now group, matching `css(stackStyleFn(styles))`.
- **The `css` prop on a `styled` element** was hashed apart from the style props beside it, though the factory merges
  both into a single `css(propStyles, cssStyles)` call. It now merges the way `mergeCss` does — normalizing each operand
  and then deep-merging, so a shorthand and its longhand collide as they will at runtime and a shared key holding a
  condition object keeps every branch. A `*Css` prop belongs to another slot and still gets its own call.
- **`cva()` and `sva()` called directly**, and **config recipe compound variants**, asked for a group while the build
  hashed each variant's styles on its own — the only thing possible, since which combinations a caller selects is not
  knowable at build time. Their runtime now names classes through a new internal `__atomicCss`, identical to `css`
  unless `cssMode: 'grouped'` is set.

`@bamboocss/vite` folds the recipe half the same way, so a folded call agrees with both.

What is still broken under `grouped` is now documented in the `cssMode` reference: JSX factories that merge several
extracted objects into one grouped call, conditional values outside `css()`, and style objects the build cannot fully
resolve.

`cssMode: 'atomic'`, the default, is unchanged.
