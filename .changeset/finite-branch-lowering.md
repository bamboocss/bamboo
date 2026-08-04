---
'@bamboocss/vite': minor
---

Lower a ternary style value to a ternary between two class literals, instead of leaving the property to the runtime.

- `css({ margin: '2', color: isError ? 'red.500' : 'green.500' })` now folds to
  `cx('m_2', isError ? 'c_red.500' : 'c_green.500')`, removing the `css()` call entirely when nothing else is dynamic.
- Independent conditionals stay linear: two of them emit two ternaries, not four combinations.
- Declined when a branch does not resolve, when two ternaries would emit a class for the same property, when the
  conditional was written somewhere other than the call site, and when hoisting the condition would reorder it against a
  dynamic value beside it. A declined lowering sends its property back to the runtime call rather than giving up the
  split, so the static half is still hoisted.
- `FoldedCall` gains `classNames`, listing every class literal the rewrite emits including both arms of each ternary.
  `className` continues to hold only the part resolved outright, which is empty when a call lowered entirely.
