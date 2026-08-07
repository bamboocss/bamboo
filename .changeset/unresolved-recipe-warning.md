---
'@bamboocss/parser': minor
'@bamboocss/node': minor
---

Report a recipe config the build could not fully read, instead of emitting a stylesheet nothing will ask for.

A `cva`/`sva` config with a spread the extractor cannot resolve loses those declarations — and since 1.16 that is not a
partial loss. A recipe's classes are named from a hash of its config, so a dropped declaration changes the hash: the
build emits rules under one name and the browser asks for another, and the element renders with **no styles at all**.

```jsx
cva({ base: { ...getFocusRing(), color: 'red' } })
// build emits  .cva_iPlRDu, .cva_iPlRDu--size_sm
// browser asks cva_gLgUZR…      — nothing matches
```

Before 1.16 atomic class names were content-addressed per declaration, so the spread's properties were missing but
everything the build _did_ resolve still applied. Semantic recipe naming turned that benign limit into total loss.

The detection already existed — `findUnresolvedStyles`, added for `cssMode: 'grouped'`, where one class names a whole
`css()` call. That gate was right for what it was written for and was never extended when recipes gained the same
property, in every mode. Recipes are now checked regardless of `cssMode`, and the message says what to do:

```
🎋 warn [recipe] app/Button.tsx:4:18 — an object spread or computed key leaves the build unable to tell
which properties this call sets. A recipe's classes are named from a hash of its config, so a declaration
the build cannot see gives the build and the browser different names and the element renders with no
styles at all. Set `className` on the recipe, so its name does not depend on what the build could resolve.
```

`className` is the fix as well as the workaround: the identity short-circuits on it and never hashes the styles, so
extraction fidelity stops deciding the name and the loss degrades to the missing declarations alone. A recipe that sets
one is not reported.

Reported per level with its path — `base`, `variants.size.sm`, `base.root` for a slot — and only where the spread
actually contributed nothing, so a resolvable spread stays quiet.

This does not change what CSS is emitted. `css()` in atomic mode still drops an unresolvable spread silently; that is
unchanged and pre-existing.
