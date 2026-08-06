---
'@bamboocss/vite': patch
---

Stop the fold splitting one `css()` call, or one styled element, across several class names under `cssMode: 'grouped'`.

A grouped class names a whole call, so a split hashes a fragment on each side, and the build emitted no rule for the
fragment — leaving the element with **no** styles at all:

- `css({ margin: '2', color: c ? 'red.300' : 'green.300' })` folded to three class names with a rule behind none.
- Two ternaries in one call folded to four, while the build emits the four _combinations_ — a different set entirely.
- `<styled.div margin="2" _hover={{ color: 'red.300', background: tone }} />` hoisted a `margin`-only literal, where the
  build hashes `margin` together with the resolved part of `_hover`.

The fold now declines a split under `grouped` unless a single piece carries the whole object. A fully static call or
element still folds, and so does a lone ternary, whose two arms the build emits as two complete groups. Everything else
keeps its runtime call.

`cssMode: 'atomic'`, the default, is unaffected.
