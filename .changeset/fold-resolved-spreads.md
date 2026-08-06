---
'@bamboocss/extractor': minor
'@bamboocss/vite': minor
---

Fold a spread the extractor could account for, instead of declining every spread.

The rule was "an inline object literal, or nothing". Not caution for its own sake — the extractor records what a spread
_contributed_, so one it flattened and one it silently skipped were indistinguishable in the result. Both simply add
keys, or fail to. Folding the second would have dropped styles with no error.

`BoxNodeMap` now carries `resolvedSpreads`: the spreads the extractor walked structurally, recorded as their own
expression nodes. That makes the two cases separable, so only the second declines:

```tsx
const known = { padding: '4' }
css({ color: 'red.300', ...known }) // → "c_red.300 p_4"

// styles.ts
export const shared = { padding: '4' }
// use.tsx
css({ color: 'red.300', ...shared }) // → "c_red.300 p_4", with styles.ts registered as a watch dependency
```

Source order is preserved, so a spread still overrides what it lands on.

Three decisions worth stating, because each is the difference between this being safe and not:

**The list is of successes, not failures.** A consumer asks "may I trust this spread", and a list of what went wrong
answers that only while it is exhaustive — an omission there is a wrong fold. A list of what went right is safe to be
incomplete, because an omission costs a fold that does not happen.

**Being walked is not being complete.** The extractor builds a map whenever it walked the object literal, however many
of that object's properties it dropped along the way, and once they are flattened the loss is unrecoverable. So the
record carries the map itself and the spread object gets the same audit the call does. Without that, these fold while
silently losing styles:

```tsx
const partial = { padding: '4', ...rest } // rest is unknown
css({ color: 'red.300', ...partial }) // would have folded to "c_red.300 p_4"

const computed = { padding: '4', [key]: '2' } // key is unknown
const branching = {
  padding: '4',
  get mm() {
    return x ? '1' : '2'
  },
}
```

All of them now decline.

**An _evaluated_ spread is not recorded, only a _walked_ one.** When the extractor runs an expression and gets a plain
value back, the keys are re-boxed against the spread site and the file they came from is no longer recoverable from the
tree. Folding that would produce a literal depending on a module the build cannot name — and so cannot watch. That is
why an imported `css.raw()` value spread inside a nested selector still declines, while an imported plain object folds
and reports its module.

`resolvedSpreads` is kept off the map's `value` and is therefore invisible to `unbox`, so nothing that generates CSS
sees it. No CSS output changes.
