---
'@bamboocss/vite': patch
---

Say what to do with a value that has no finite set of possibilities, and stop describing extraction-only fallbacks as if
they applied to the compiler.

A progress bar's width or a dragged element's offset has no rule a build could emit for it, so it belongs in the `style`
attribute — which is smaller than any alternative and needs nothing from Bamboo. Every styling system hands that back to
the author eventually; Bamboo's docs did not say so, which left it reading as a gap the reader had missed rather than as
the answer.

The CSS-variable pattern is for the one thing the `style` attribute cannot do, since it sits outside the cascade: a
value that has to vary by condition — a dragged width that still collapses on a small screen — or stay overridable by a
consumer, which is the one place "a consumer's `css()` wins" otherwise does not hold. The guide now says that, in that
order, rather than listing five techniques and leaving the choice to the reader.

The dynamic-styling guide now opens with which option applies to which kind of value, and the two sections that describe
a fallback — `staticCss` pre-generation and "a runtime condition generates the CSS for every branch" — say that they
describe the CLI and PostCSS path. Under the Vite compiler both of those calls fail the build instead, which is verified
rather than assumed: `css({ color: on ? 'red600' : 'blue600' })` is rejected as `dynamic`, and a recipe variant compiles
to a lookup over precompiled class strings.
