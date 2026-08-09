---
'@bamboocss/vite': minor
---

Lower config recipe calls in wrapper components, not just inline ones.

The previous release lowered `input(variantProps)` for recipes bound with `cva`. A recipe declared with `defineRecipe`
and reached through the generated `recipes/` barrel did not lower, because the candidate map was built from the module's
own `cva` definitions. That left the most common way to ship a design system — a vendored preset, wrapped by components
— as the one shape that could not fold:

```tsx
export const Input = ({ className, ...props }: InputProps) => {
  const [variantProps, rest] = input.splitVariantProps(props)
  return <ark.input className={cx(input(variantProps), className)} {...rest} />
}
```

Both halves now lower for config recipes exactly as they do for inline ones — the call to one `cvaPick` term per
declared variant, and `splitVariantProps` to the `splitProps` it already called.

**Restricted to a selection that provably holds declared variants only**, which in practice means the output of
`<recipe>.splitVariantProps(...)` for that same recipe. This is not conservatism for its own sake: the generated
`createRecipe` names a class for **any** prop it is handed —

```js
return { className: `${name}--${prop}_${value}` } // no check that the variant is declared
```

— where `cva` skips a value the config does not declare. The two runtimes therefore disagree about an undeclared key,
and a lowering derived from the config cannot produce a class for a key it cannot enumerate. `splitVariantProps` filters
to `Object.keys(variants)`, so its output cannot contain one. An arbitrary object, or a selection split from a
_different_ recipe, still declines.

A parity suite compares the lowered expression against the recipe the codegen actually emitted — `createRecipe`, not
`cva` — across defaults, multi-axis selections and compound variants. Slot recipes still decline: they resolve to one
class per slot rather than to a string.
