---
'@bamboocss/generator': minor
'@bamboocss/shared': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/vite': minor
---

Remove the responsive array syntax, so a responsive value has one spelling.

`fontWeight: ['medium', undefined, undefined, 'bold']` used to mean one value per breakpoint. Write the condition object
instead:

```ts
css({ fontWeight: { base: 'medium', lg: 'bold' } })
```

The array form was the worse of the two on its own terms — positional, so skipping a breakpoint needed `undefined`
padding, and inserting a breakpoint re-pointed every value after it. But the reason it had to go is that CSS already
writes lists as arrays, so a font stack written the obvious way

```ts
css({ fontFamily: ['Inter', 'sans-serif'] })
```

compiled to `Inter` at base and `sans-serif` at `sm`, with no error and nothing in the type to suggest it.

An array in a style value is now an error naming the property it was written on, rather than a silent reinterpretation.
The type no longer admits one either: `ConditionalValue` drops its array member, and `CssProperties` is built from
csstype's `Properties` rather than `PropertiesFallback` — that array meant repeated declarations, which `fallback()`
already expresses and which the runtime never implemented.

A pattern property takes the same conditional value, so `grid({ columns: [2, 3, 4] })` becomes
`grid({ columns: { base: 2, sm: 3, md: 4 } })`.

The generated runtime no longer carries the breakpoint key list into `css`, `cva` and `mergeCss` — it existed only to
expand these arrays.
