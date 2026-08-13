---
'@bamboocss/vite': minor
---

Stop compiling a destructuring default as if it were the value.

A component taking a `css` prop with a default returned the default's classes no matter what its caller passed:

```tsx
const A = ({ css: cssProp = { color: 'red.300' } }) => css(cssProp)

A({ css: { color: 'blue.500' } }) // → "c_red.300". Not blue.
```

Not missing styles — _wrong_ styles, silently. The build was green, the class names in the markup were real, and no skip
was recorded, so the survivor check that exists to catch uncompilable calls never saw it. The empty spelling,
`({ css: cssProp = {} }) => css(cssProp)`, folded to `""`, which reads like "nothing to do here" rather than like a
caller's styles being discarded.

It is not limited to parameters. The default wins over a source object that plainly carries the key:

```ts
const source = { tone: 'blue.500' }
const { tone = 'red.300' } = source
css({ color: tone }) // → c_red.300
```

The extractor resolves a binding element's default without consulting what is being destructured: its
`maybeDefinitionValue` tests for an initializer first and returns the boxed default, never reaching the branch that
would read the source object.

Extraction is left alone, and not only because emitted CSS is sacred — the rule is _wanted_ there. A CLI or PostCSS
build ships a runtime `css()`, where the default genuinely does apply when a caller omits the key, so it needs CSS
behind it. Being optimistic costs extraction one rule; it costs compilation the right answer, because compilation
_replaces_ the call. So the fix is in the compiler's `isStaticBox`, and emitted CSS is unchanged.

**A call whose value comes from a destructuring default is now declined**, which under mandatory compilation is a build
error naming the call. That is the intended outcome: there is no runtime styling fallback to degrade to, so the
alternatives are a failed build or wrong styles in production. Move the variation into declared recipe variants, pass a
finite set of values, or safelist with `staticCss`.

Note the direction this had been pointing: `const { tone } = source` was already declined, and adding a default to that
same line made it start folding — to the default. More information made the compiler more confident and less correct.

Two things this does not reach. A call _written inside_ a default — `({ cls = css({ color: 'red.300' }) }) => cls` —
still folds, correctly, since its argument is written right there; but a later read of `cls` is not refused, and a
caller can still have replaced it. And a default destructured in one module and consumed in another still folds, as the
no-default spelling there always did. Both are narrower than what this closes, and neither is new.

`sandbox/vite-ts/src/Button.tsx` still ships the broken pattern — it is why those call sites were not among the ones
that sandbox already failed to build on, and it now declines two more. Fixing the example is separate.

Measured by counting the work rather than timing it, since this sits on the dev server's per-transform path and
wall-clock could not resolve it against a loaded machine: the guard's parent walks over `sandbox/vite-ts/src/App.tsx`
are **281**, against 8,416 for a first cut that walked to the root from every stack entry. The walk stops at the first
parent that computes rather than composes a value, which is also what keeps a call inside a default foldable.
