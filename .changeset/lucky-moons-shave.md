---
'@bamboocss/generator': patch
'@bamboocss/fixture': patch
'@bamboocss/postcss': patch
'@bamboocss/core': patch
'@bamboocss/node': patch
---

Fix conditional token values being silently dropped on postcss `>= 8.5.25`.

A semantic token declared with a conditional value emitted only its `base` half — no error, no warning — so a themed app
kept its light values in dark mode:

```ts
semanticTokens: {
  colors: {
    panel: { value: { base: '#ffffff', _osDark: '#131211' } },
  },
}
```

```css
/* before — the `_osDark` half never reached the tokens layer */
@layer tokens {
  :where(:root, :host) {
    --colors-panel: #ffffff;
  }
}
```

`getDeepestRule` seeded its nesting chain with an empty-selector rule and relied on postcss-nested erasing `&` against
it. postcss 8.5.25 ("Fixed 8.5.17 visitor regression") changed that edge case to collapse the whole selector, so every
conditional token was emitted as a selectorless — and therefore discarded — rule. The chain is now built on a `Root`,
and the top-level `&` is resolved directly instead of through postcss-nested.
