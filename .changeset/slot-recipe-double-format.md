---
'@bamboocss/generator': patch
---

Fix slot recipes without a `root` slot naming every slot class twice over, so they rendered completely unstyled.

`createRecipe` routes the name it is given through `createCss`, which applies `hash.className` and `prefix.className`
itself. The generated template has two branches, and only one accounted for that:

```js
// a recipe that anchors: raw name, formatted once by createCss — correct
createRecipe(`combobox__${slotName}`, …)

// a recipe with no anchors: slotKey has already been through formatRecipeClass — formatted twice
createRecipe(slotKey, …)
```

So the runtime asked for `toHash(toHash(name))` while `cssgen` emitted rules under `toHash(name)`. Confirmed against a
production build: `menu__content` is emitted as `gwnspZ` and the DOM carried `jyBcnE`; `menu__positioner` is emitted as
`cXdnZS` and the DOM carried `iRSbhH`. Neither runtime class occurs anywhere in the shipped stylesheet.

Six recipes have that shape — `dialog`, `drawer`, `hover-card`, `menu`, `popover` and `tooltip` — and every slot on them
was unstyled. It reads as a stacking bug rather than a naming one, because `menu.positioner` carries the `zIndex` that
holds a popover above the page: the rule is emitted, nothing matches it, and the popover falls to `z-index: auto`.

**It was not only hashed builds.** `formatRecipeClass` applies the prefix as well, and that is not idempotent either — a
prefixed build produced `bam-bam-menu__trigger` against a stylesheet emitting `.bam-menu__trigger`. The bug is invisible
only when neither `hash` nor `prefix` is set, where both applications are identities, which is why it survived
development and appeared in production.

**Regression coverage**

`slot-recipe-class-parity.test.ts` writes the generated system to disk, imports it, and asserts that every class the
recipe returns — and every entry in `classNameMap` — is a class the stylesheet emits a rule for. Across the whole
`{hash} × {prefix}` matrix, for a recipe that anchors and one that does not.

Reading the class from the artifact rather than recomputing it is the point. An earlier version of this test derived
both sides from the context, which only asserts that `cssgen` agrees with itself — it passed while every one of these
slots was unstyled, and it passed again when the slot separator was changed to something the stylesheet never emits.
