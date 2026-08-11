---
'@bamboocss/types': minor
'@bamboocss/generator': minor
'@bamboocss/core': minor
'@bamboocss/reporter': minor
---

Remove `variantKeys` from a recipe, leaving `variantMap` as the one way to ask what variants it has.

The two were never independent — `variantKeys` was `Object.keys(variantMap)`, computed once and stored beside it. Ask
the map:

```ts
Object.keys(button.variantMap) // was button.variantKeys
button.variantMap.size //         unchanged
```

`splitVariantProps` is unaffected, and remains the way to pull variant props out of a props object without naming them.

Internally `RecipeNode` carried the same fact three times — `variantKeys`, `variantKeyMap`, and `props`, the last two
being the map and a second copy of the keys. Only `variantKeyMap` remains. That type is exported from `@bamboocss/core`,
so a plugin reading `node.props` or `node.variantKeys` reads `Object.keys(node.variantKeyMap)` instead.

`variantMap` keeps its name rather than becoming `variants`: on the config that word already means the style
definitions, and a `button.variants` that answered `{ size: ['sm', 'md'] }` instead of the objects you wrote would be a
worse kind of ambiguity than the one being removed.
