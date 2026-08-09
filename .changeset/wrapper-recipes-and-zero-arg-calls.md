---
'@bamboocss/vite': minor
'@bamboocss/generator': minor
---

Fold recipe calls in wrapper components, and fix recipe calls written with no arguments.

**Wrapper components.** A component that forwards its own props to a recipe is the shape that kept the recipe alive:

```tsx
export const Input = ({ className, ...props }: InputProps) => {
  const [variantProps, rest] = input.splitVariantProps(props)
  return <ark.input className={cx(input(variantProps), className)} {...rest} />
}
```

The build cannot see inside `variantProps` — the variants are the component's public API, so they can never be literals.
It does not need to. A recipe emits one class per **declared** variant, so the call is one term per variant reading that
binding:

```tsx
className={cx(
  'cva_x' + cvaPick(variantProps.size, { sm: ' cva_x--size_sm', md: ' cva_x--size_md' }, ' cva_x--size_md'),
  className,
)}
```

`splitVariantProps` is lowered alongside it, to the `splitProps` it already called — the keys it splits on are
`Object.keys(variants)`, known at build time. That matters because it is the last thing reading the binding; without it
the recipe object stays referenced and its config cannot leave the bundle. `splitProps` is now re-exported from the
generated `cx` module, so both lowerings reach for one place.

**`Input` keeps taking variants at runtime.** Measured on a bundle of exactly this shape: **10,459 B → 3,558 B**, 4,073
→ **1,598 B gzipped**, with both the recipe config and the style engine dropping out.

**Calls written with no arguments.** `buttonStyle()` declined while `buttonStyle({})` folded — the parser stores a
fallback box for a call with no argument, and the fold required a static one. Nothing to account for is not the same as
something unaccounted for. This affected config recipes, inline recipes and patterns alike:

```ts
buttonStyle() // → "buttonStyle buttonStyle--size_md buttonStyle--variant_solid"
stack() // → "d_flex flex-d_column gap_8px"
```

Class names are still derived through `getRecipeIdentity` and `getRecipeClassNames` — the same functions the browser
runs — and a parity suite compares the lowered expression against the real generated `cva` across every shape of props,
including `{}`, `undefined`, `null`, an undeclared value, and keys the recipe does not declare.
