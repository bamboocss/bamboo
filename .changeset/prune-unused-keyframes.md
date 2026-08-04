---
'@bamboocss/generator': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/node': minor
---

Add `pruneUnusedKeyframes`, dropping `@keyframes` rules nothing can reach.

A preset declares every animation it offers and an app uses a handful. The rest sit in the one stylesheet that blocks
first paint. On the fixture preset this drops all four unused keyframes and 436 bytes; it scales with the size of the
design system rather than the app, the same way `pruneUnusedTokens` does.

It is **off by default** and changes nothing until switched on.

Only keyframes the theme declares are ever removed, so one emitted by `globalCss` is left alone. A name is kept when an
animation property in the generated css names it, when it appears anywhere under `include`, or when it is named in a
custom property that is itself reachable.

That last clause is what makes the pass worth having. `preset-bamboo` declares
`--animations-spin: spin 1s linear infinite` whether or not anything uses that token, so counting every custom property
as a reference would keep every keyframe the preset ships. References from a custom property are held back and only
credited once the property is reached through `var()`, following the chain — the same reachability model
`pruneTokenVars` uses.

Names are recovered by tokenizing values and testing each token against the declared set, rather than by parsing the
`animation` shorthand, which interleaves durations, easings and directions in any order. A keyframe named after a
keyword therefore always looks referenced. That is the intended bias: keeping an unused keyframe costs bytes, dropping a
used one silently stops an animation.

The textual scan over `include` covers what the css cannot show — an animation name assembled at runtime, or applied
through an inline `style` rather than through bamboo.
