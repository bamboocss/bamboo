---
'@bamboocss/generator': minor
'@bamboocss/config': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
---

Let a slot recipe name the slot its variants scope by, with `scopeRoot`.

Scoping a slot recipe's variants to its root needs an enclosing slot to anchor on, and until now that had to be a slot
literally named `root`. A component library's wrapper is not always called that — and sometimes the slot called `root`
renders no DOM element at all, which is the case that makes this necessary rather than convenient. A menu whose only
real ancestor is `positioner` had no way in.

```ts
defineSlotRecipe({
  className: 'menu',
  slots: ['trigger', 'positioner', 'item'],
  scopeRoot: 'positioner',
  variants: { size: { sm: { item: { padding: '2' } } } },
})
```

`item` is inside `positioner`, so its variant styles are emitted as rules scoped by the class `positioner` carries, and
its own class stays constant. Unset, the default is still a slot named `root`, so nothing changes for recipes that have
one.

Only slots rendered _inside_ the named one are reached. A slot a portal moves out of that subtree is not — `trigger`
above is a sibling — and needs its variant delivered by hand. `recipe.slotsAffectedBy` says which slots each variant
actually writes styles for, so only those need threading.

A `scopeRoot` naming a slot the recipe does not declare is now a config error rather than a silent fallback to per-slot
variant classes, which would have looked correct while quietly reinstating the runtime distribution the recipe was
written to avoid.
