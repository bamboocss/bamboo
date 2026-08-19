---
'@bamboocss/core': patch
---

Fix at-rule sorting for breakpoints written in any unit other than `ch`, `em`, `ex`, `px` or `rem`.

The length parse matched that alternation and fell back to a single digit for everything else, so a query's sort key
became its first digit: `(min-width: 100vw)` scored 1 and `(min-width: 20vw)` scored 2. For mobile-first `min-` queries
that is the reverse of the order the cascade needs — the wider breakpoint lost to the narrower one at every viewport
where both applied, and the only symptom was one wrong declaration at some sizes.

It reached every unit outside that list: `vw vh vi vb vmin vmax` and their `s`/`l`/`d` variants, the container units
`cqw cqi cqh cqb cqmin cqmax`, and the absolute units `in cm mm Q pt pc`. Container queries are the most exposed, since
`cq*` is the natural unit to write them in.

- Absolute units now convert exactly; font-relative ones convert against the same 16px root the sorter already assumed,
  with `ex` and `ch` keeping their existing constants so stylesheets that sort correctly today are untouched.
- Viewport- and container-relative units have no pixel value to compare against a `px` breakpoint, so each family is
  ordered within itself and placed after everything that does resolve to a length, rather than against an invented
  reference viewport.
- A bare number is read as a length only when it is `0`, the one unitless length CSS accepts. Previously a query could
  be scored by an adjacent non-length feature, such as `(-webkit-min-device-pixel-ratio: 2)`.

Sorting of `px`, `rem` and `em` breakpoints is unchanged.
