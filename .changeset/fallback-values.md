---
'@bamboocss/generator': minor
'@bamboocss/shared': minor
'@bamboocss/core': minor
---

Add `fallback(...)` for progressive-enhancement values.

CSS expresses a value fallback by declaring the same property more than once — the browser keeps the last declaration it
can parse. A style object cannot hold the same key twice, so there was no way to write one. `fallback(...)` closes that
gap:

```js
css({ height: 'fallback(calc(100dvh - 100px), calc(100vh - 100px))' })
```

```css
.h_fallback\(calc\(100dvh_-_100px\)\,_calc\(100vh_-_100px\)\) {
  height: calc(100vh - 100px);
  height: calc(100dvh - 100px);
}
```

Candidates are written most-preferred first and emitted in reverse. Each one resolves like an ordinary value, so tokens,
the `[...]` escape hatch and shorthand properties all work inside a fallback, as do conditions, breakpoints,
`globalCss`, recipes, patterns and JSX style props. `!important` marks every candidate. Under `strictTokens`,
`fallback(...)` is accepted alongside the other escape hatches, though the candidates inside it are not individually
checked — the same trade-off the `[...]` escape hatch already makes.

Only a value that is _entirely_ one `fallback(...)` call is treated as a candidate list —
`1px solid fallback(red, blue)` is left alone.

Every candidate has to resolve to exactly one declaration, because that is all the cascade arbitrates between. A
candidate that expands further — `transitionProperty` emits a `--transition-prop` variable beside the property,
`lineClamp` emits four declarations for a number and one for `none`, `divideX` emits a nested rule — would leave those
extras applying unconditionally whichever candidate the browser took. Those warn and apply the preferred candidate
alone.

Malformed calls warn and drop the declaration rather than emitting text that is not CSS: an unbalanced `(` or `[`, and a
`fallback(...)` nested inside another. A misspelled name or one embedded in a larger value (`calc(fallback(a, b))`) is
an ordinary string that Bamboo cannot recognise, and reaches the stylesheet verbatim.

Reach for it when the fallback is a different design decision rather than a polyfill. If you use LightningCSS, it
already generates vendor-prefix and color-space fallbacks from your browser targets, and it prunes the ones your targets
don't need — including candidates you write yourself.
