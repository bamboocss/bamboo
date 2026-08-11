---
'@bamboocss/generator': minor
'@bamboocss/types': minor
'@bamboocss/vite': minor
---

Add `leafFallback`, which is what makes zero runtime reachable for an app that has any dynamic styling.

The fold's payoff is not the per-call CPU it saves — it is that a bundle where everything lowered stops importing
`styled-system/css`, and the engine drops out. One reference keeps the whole thing, and there is exactly one: `cssLeaf`
falls back to `css({ [prop]: value })` for a value that turns out to be a condition object or a responsive array, which
no class-name concatenation describes.

That fallback is reachable only for a value the fold could not see the shape of, and it costs everything. On
`sandbox/runtime-perf`, one dynamic leaf:

|                                | raw      | gzip    | top-level bindings |
| ------------------------------ | -------- | ------- | ------------------ |
| `leafFallback: true` (default) | 22,154 B | 7,542 B | 39                 |
| `leafFallback: false`          | 2,094 B  | 1,077 B | 10                 |

7.0x on gzip, because the reference pulls in `createCss`, the merge, the utility and shorthand tables and the conditions
— for a branch that fires only when the value is not a scalar.

Setting `leafFallback: false` removes it. The generated `cssLeaf` then throws for the two shapes `leafClass` declines,
naming the property, rather than returning a class with no rule behind it. What you are asserting is that **a style
value that varies at runtime is a scalar** — write conditions and responsive values as literals at the call site, where
the fold reads them and resolves each branch.

`failOnUnfolded` in `@bamboocss/vite` follows: a lowered leaf is reported as `lowered-leaf` because of that reference,
so with the fallback off it is no longer a survivor. This is the part that matters — with the fallback on,
`failOnUnfolded` can only pass an app with _no dynamic styling at all_, which is a far narrower target than it sounds.
Together the two options move it to "an app whose dynamic values are scalars", which is most of them.

The option narrows what counts as surviving; it does not weaken the guarantee. A spread the build cannot see is still a
real `css()` in the output and still fails.

Default unchanged, so nothing moves unless you ask for it.
