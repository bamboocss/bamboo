---
'@bamboocss/core': patch
'@bamboocss/shared': patch
'@bamboocss/generator': patch
'@bamboocss/vite': patch
---

Four fixes found by auditing the recipe work for edge cases. Three are silent failures of the same shape: a class name
derived one way for the stylesheet and another way for the browser.

**The fold emitted broken JavaScript for a property access on `css()` or a pattern.** Folding a slot access widened the
replaced range to cover the member expression — but the widening applied to every foldable call, so the property read
was deleted:

```js
css({ color: 'red' }).trim() // → "c_red"()          TypeError
flex({ direction: 'row' }).split(' ') // → "d_flex flex-d_row"(' ')
```

It now fires only for a recipe whose accessed property names a slot the recipe declares.

**Every compound variant was dead under `hash: true` or `prefix`.** A compound's selector is assembled from class names,
and it was assembled from raw ones while the element carried prefixed or hashed ones — so `.btn--size_sm.btn--tone_a`
selected nothing while the element carried `bam-btn--size_sm bam-btn--tone_a`. The selector is now built through the
same `formatSelector` as every other class.

**A compound variant on a scoped slot recipe matched nothing at all.** A scoped slot carries only its constant class, so
a compound selecting on that slot's variant classes can never apply. It is now scoped by the anchor, like the variants
it refines:

```css
@scope (.cmp__root--size_lg.cmp__root--tone_a) to (.cmp__root) { .cmp__item { … } }
```

**Two slot recipes differing only in `slots` or `scopeRoots` collided.** `getRecipeIdentity` hashed only the style
fields, so "same styles, different DOM topology" — exactly what `scopeRoots` exists for — produced one name. An inline
recipe is registered once, so whichever was extracted first decided the emission for both and the other rendered
unstyled. Both fields now count toward the identity, which changes the generated name of every anonymous `sva`.

**`auditSlotScopes` was a no-op under `hash` or `prefix`.** It builds its selectors from `classNameMap`, and an inline
`sva` populated that map with raw names while returning formatted ones — so the diagnostic went silent in precisely the
configs where a naming bug is likeliest. Config slot recipes were already correct; the two now agree.
