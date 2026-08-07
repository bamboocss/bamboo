---
'@bamboocss/core': minor
'@bamboocss/generator': minor
---

Drop `@property` registrations for custom properties the stylesheet never uses, under `pruneUnusedTokens`.

`preset-base` registers the custom properties its utilities compose with — filters, gradients, transforms, transitions —
so a value cannot inherit into a descendant that declares its own. Those registrations are derived from the config
rather than from usage, so an app that draws no gradients still ships all 42. Across the projects in this repo, 93-100%
of them are dead:

| project               | @property before -> after | raw              | gzip             |
| --------------------- | ------------------------- | ---------------- | ---------------- |
| `sandbox/next-js-app` | 42 -> 0                   | 17,203 -> 3,812  | 5,051 -> 1,606   |
| `website`             | 42 -> 3                   | 72,675 -> 60,590 | 14,796 -> 11,912 |

(Those totals include the token and keyframe pruning that already ran; the registrations are about 250-300 bytes gzipped
of it. The raw share is much larger than the compressed one — 42 near-identical blocks gzip well — so judge it on the
gzip column.)

A registration is removed only when the finished stylesheet neither declares nor reads the property, using the same
reachability walk the token declarations already use. It is deliberately _not_ gated on which utility the project used:
`--gradient-stops` is registered once, by `backgroundGradient`, and composed by `bgLinear`, `bgRadial`, `bgConic` and
`textGradient`, so a project using only `bgRadial` uses the property without using the utility that declares it. Gating
on the declaring utility would drop it and let a parent's gradient inherit again — the bug that registering these fixed
in the first place. Asking what the finished stylesheet contains avoids that question entirely.

Registrations written through `globalVars` are never removed, the same way pruning only ever removes custom properties
the token system declared.

The one shape this cannot see is a property both written and read entirely outside the emitted css — a hand-written
stylesheet outside `include` doing `.a { filter: var(--blur,) }`. Inside `include` the source scan already catches it.
Hold it with `staticCss`, or declare the `@property` yourself through `globalVars`.
