---
'@bamboocss/generator': patch
---

Stop shipping the JSX property list twice.

`jsx/is-valid-prop` carried two string constants that the runtime immediately concatenated into one lookup: the browser
CSS properties, and the project's own properties and shorthands. They overlap heavily — 285 of the 1,134 entries
appeared in both — and every consumer of the JSX factory downloaded and parsed the overlap twice. At 15,684 bytes it was
the largest single module in the generated runtime, and roughly a third of what
`import { Box } from 'styled-system/jsx'` pulled in.

The two lists are now merged into one deduplicated list at generation time. The module drops to 11,468 bytes. Combined
with the `sideEffects` declaration, a JSX barrel import goes from 41.2 KB to 30.1 KB minified and 12.6 KB to 10.2 KB
gzipped.

The set of recognised properties is unchanged — 849 before and after, verified by diffing the two — so `isCssProperty`
answers identically and no prop that used to be treated as a style prop now leaks to the DOM. The exported
`allCssProperties` holds the same members, without the duplicates; anything reading its `length` rather than its
contents will see 849 instead of 1,134.

Two related fixes fall out of the rewrite:

- A failure to match the prebuilt module is now an error rather than an empty list. These rewrites match bundler output
  and have silently missed before; an empty list is not a degraded system but a broken one, since every style prop would
  render as a raw HTML attribute.
- The substitution runs through a replacer function, so a `$` in a project property is no longer interpreted as a
  replacement pattern.

Under `jsxStyleProps: 'minimal'` or `'none'` the browser list was already dropped, and still is; that path now emits
`"css"` instead of an empty string alongside it.
