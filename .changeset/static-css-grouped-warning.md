---
'@bamboocss/node': patch
---

Warn when `staticCss.css` is configured alongside `cssMode: 'grouped'`.

`staticCss` is documented as the escape hatch for values the build cannot see — pre-generate `color: ['red.300']` and a
runtime `color` prop holding `red.300` finds a rule waiting. That does not hold under `grouped`, and cannot be made to:
`staticCss` enumerates atoms, one rule per property, value and condition, while a grouped class names a whole `css()`
call. Backing an arbitrary call site would mean pre-generating every combination of properties it might contain rather
than every value it might hold.

The rules are still emitted and are still valid classes to write by hand, so nothing is removed. But no class a grouped
runtime returns will match one, and the pairing previously produced CSS that looked like a working escape hatch and
silently was not.

Documented in the `cssMode` limitations and in the dynamic styling guide.
