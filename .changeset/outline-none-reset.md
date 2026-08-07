---
'@bamboocss/preset-base': patch
---

Fix `outline: 'none'`, which referenced a token instead of resetting the outline.

The utility special-cases `none`:

```ts
transform(value) {
  if (value === 'none') return { outline: '2px solid transparent', outlineOffset: '2px' }
  return { outline: value }
}
```

That branch never ran. `outline` declares `values: 'borders'`, and a utility whose `values` is a token category has its
value resolved **before** the transform is called — so `value` arrived as `var(--borders-none)` and the comparison
against `'none'` could not match. No preset defines a `borders.none` token, so the emitted declaration referenced a
variable that does not exist, which is invalid at computed-value time and dropped. `outline: 'none'` therefore left the
outline exactly as it was: the opposite of what was asked for, silently.

The check now reads `raw`, the value as written, and `outline: 'none'` emits `2px solid transparent` with a `2px` offset
— transparent rather than `none` so the ring survives forced-colors mode, where there is nothing to repaint otherwise.

Three snapshots had recorded the broken output as expected, which is the reason the new tests assert the shape a
transform is responsible for rather than snapshotting a whole rule.

The same mistake is not present elsewhere: `float` and `scrollbar` compare against their values too, but their `values`
is a plain array — an enum of keywords rather than a token category — so nothing is resolved before they see it, and
`lineClamp` declares no `values` at all. Tests now cover all three alongside the fix.
