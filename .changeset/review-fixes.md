---
'@bamboocss/core': patch
'@bamboocss/generator': patch
'@bamboocss/vite': patch
---

Five fixes from an adversarial review of the previous batch. Four are in code that batch introduced.

**The fold declined where the runtime throws — but only for scoped recipes.** A slot recipe call runs a `recipeFn` per
slot, each calling `assertCompoundVariant`. Which slots get one depends on scoping: with anchors only they do, without
them every slot does. The guard read the anchors alone, and `[].some()` is false — so an _unscoped_ recipe with compound
variants folded a class where the call throws.

**`cva().merge()` was not associative.** `a.merge(b).merge(c)` dropped `b` entirely, because the merged object
re-exposed the left parent's `merge` closure and recomposed `a` with `c`. It now composes the _result_, so `merge` is
associative and `variantKeys` keeps every parent's.

**A merged recipe applied each parent's own defaults** while publishing merged ones, so `m()` and
`m(m.getVariantProps())` disagreed. The selection is now resolved once and handed to both parents.

**The fold rejected ordinary TypeScript.** `dyn as Size`, `dyn!`, `(dyn)` and `dyn ?? 'sm'` are erased before anything
runs, so they cannot add an effect — but the new inertness check rejected them, losing folds that landed before it
existed. It now sees through the erased wrappers, while still declining template substitutions and arithmetic, which
coerce and can reach a getter.

**A scoped compound variant lost its precedence, and a stale one could survive a rebuild.** Moving a compound into an
`@scope` rule made its inner selector one class — the same specificity and the same scoping root as every single-variant
scope — so the winner fell to stylesheet order, which for compounds is decided by whichever call site the build walked
first. The compound's inner selector is now `:scope .slot`, restoring `(0,2,0)` against a variant's `(0,1,0)` without
changing what it matches.

Separately, `slotScopes` was cleared for variants but not for compounds, both being module-global. A recipe that stopped
being scoped kept emitting the previous build's rule — naming an anchor nothing renders — and lost its own compound
entirely. Both maps are now cleared before either is written.
