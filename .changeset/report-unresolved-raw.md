---
'@bamboocss/parser': patch
'@bamboocss/node': patch
---

Report `css(recipe.raw(props), …)`, which silently loses the recipe's styles.

`.raw` on a **recipe or a pattern** takes props and returns styles. The build reads it as the identity that `css.raw`
means — so it composes the _props_ instead:

```ts
css(textInput.raw(), { fontFamily: 'monospace' })

// the browser asks for : c_red.300  p_4  ff_monospace
// the build emits      : —          —    ff_monospace
```

The recipe's own declarations never reach the stylesheet, and for a call with variants the variant names are handed to
the encoder as though they were properties. The element then renders without those styles, and nothing said so. It
survives in practice only when some other component happens to emit the same atomic classes, so it breaks when an
unrelated file stops using them.

This does not resolve the composition — running the recipe during extraction to get it right is a larger change, and
emitting the wrong styles would be worse than emitting none. **CSS output is unchanged.** What changes is that the build
now says:

```
textInput.raw() composes its own props rather than its styles, so textInput's declarations
will not reach the stylesheet
  Call it instead — cx(textInput(props), css({ … })) — or move the overrides into textInput itself.
```

Reported for inline recipes, config recipes and patterns alike. `css.raw()` composition is unaffected: identity is
exactly what it means, and it reaches the stylesheet correctly.
