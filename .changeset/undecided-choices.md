---
'@bamboocss/vite': patch
---

Stop folding a choice the extractor could not decide.

The extractor answers "what styles could this produce", so when one arm of `a ? b : c`, `a || b` or `a && b` does not
evaluate it returns the other rather than refusing. That is right for generating CSS and wrong for rewriting source,
where the arm it kept becomes the only one that runs.

- `css({ color: e ? 'red.300' : fn() })` folded to `c_red.300`, silently choosing a branch. Same for
  `fn() || 'blue.500'`, `fn() && 'blue.500'`, `on && fn()` with a truthy `on`, and `empty || 'blue.500'` with a falsy
  `empty`.
- A choice with two resolvable arms still folds, including through named values and comparison conditions.
- A nested object reached by name — `css({ _hover: base })` or the `css({ _hover })` shorthand — is now checked where it
  was written, so a spread or computed key inside the declaration is no longer invisible. An object passed as the whole
  argument, `css(base)`, is not yet: the extractor rebuilds that map against the call itself, leaving no declaration to
  follow.
- A chain of short-circuits is judged all the way down, within the expression written at the call site.
  `fn() || 'red.300' || 'blue.500'` parses as `(fn() || 'red.300') || 'blue.500'`, so the outer operator was handed an
  arm the extractor had invented and read it as an ordinary literal. A choice reached through a _binding_ is still not
  judged — `const c = fn() || 'red.300'` followed by `css({ color: c })` folds to `c_red.300`.
- A comparison is no longer folded to one of its operands. `css({ color: fn() === 'red.300' })` gave `c_red.300` and
  `css({ truncate: false === false })` gave `trunc_false`, where the value is `true`. The extractor collapses `===`,
  `in`, `instanceof` and the ordering operators the same way it collapses a choice, and never computes the comparison,
  so no answer it can give is the result.
- A short-circuit folds only when its left operand is written at the call site. A box reached through a name records the
  declaration the extractor resolved through — `let m = '1'; m = undefined` still boxes as `'1'`, and a parameter
  default still boxes as its default for a caller that passed something else — and truthiness is exactly what that
  changes. So `const c = 'red.300'; css({ color: c || 'blue.500' })` no longer folds, while writing the value inline
  still does.
