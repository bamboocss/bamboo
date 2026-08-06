---
'@bamboocss/eslint-plugin': minor
'@bamboocss/preset-base': minor
'@bamboocss/extractor': minor
'@bamboocss/generator': minor
'@bamboocss/config': minor
'@bamboocss/parser': minor
'@bamboocss/shared': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/node': minor
'@bamboocss/vite': minor
'@bamboocss/dev': minor
---

**Breaking:** remove the JSX factory. Bamboo no longer generates components, and is now framework-agnostic.

`styled-system/jsx` is not emitted at all. `styled` / `bamboo`, style props, the `css` prop, `as`, `unstyled`,
`createStyleContext`, `splitCssProps` and `isCssProperty` are gone, along with `jsxFramework`, `jsxFactory` and
`jsxStyleProps`. There is no React, Vue, Solid, Preact or Qwik codegen left anywhere.

```tsx
// before
<styled.div color="red.300" padding="4">hi</styled.div>
const Button = styled('button', buttonRecipe)

// after
<div className={css({ color: 'red.300', padding: '4' })}>hi</div>
const Button = (props: ButtonProps) => {
  const [variantProps, rest] = buttonRecipe.splitVariantProps(props)
  return <button {...rest} className={cx(buttonRecipe(variantProps), props.className)} />
}
```

A consumer's `className` still beats the component's own styles, because `css()` output sits in the `utilities` layer
and a recipe's in `recipes` — so overrides stay deterministic without a factory to merge them.

**Recipe JSX tracking is kept**, and no longer depends on `jsxFramework`. A recipe's `jsx: ['Button']` hint is how the
build reads `<Button variant="danger">` on a component you wrote and emits `--variant_danger`; without it those variants
would silently stop being generated. It costs no codegen — it is extraction only.

**`createStyleContext` has no replacement in the box.** Compound components that need one slot to see the variant chosen
at the root now write their own context; `docs/concepts/slot-recipes` documents the ~20-line version.

What this removes beyond the API: the whole per-framework generator tree, `is-valid-prop` (a large module that shipped
to the browser only to decide whether a prop was a style prop), `normalize-html`, the vite fold's JSX element path —
which has nothing left to fold — and the per-framework test matrix.

`@bamboocss/plugin-vue` and `@bamboocss/plugin-svelte` are unaffected: they transform source so the extractor can read
it, which has nothing to do with the factory.
