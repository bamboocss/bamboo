---
'@bamboocss/core': minor
'@bamboocss/generator': minor
'@bamboocss/node': minor
'@bamboocss/types': minor
---

Prune unreachable tokens, keyframes and `@property` rules by default.

`pruneUnusedTokens` and `pruneUnusedKeyframes` both default to `true` now. On the example apps in this repository:

| app          |             raw |          gzip |
| ------------ | --------------: | ------------: |
| svelte       |  22,047 → 5,188 | 5,442 → 1,802 |
| runtime-perf |   9,107 → 3,462 |   1,941 → 989 |
| vite-ts      | 13,845 → 10,463 | 3,390 → 3,053 |

That is 10–67% of the gzipped, render-blocking stylesheet, and it scales with the size of the design system rather than
the size of the app — so the larger the theme, the more of it was being shipped for nothing. `bamboo init` already
turned both on, so newly scaffolded projects had this and everyone else did not.

Set either to `false` to restore the previous behaviour.

**`@property` registrations no longer depend on the flag**

A preset registers every custom property its utilities compose — filters, gradients, transforms, transitions — from the
config rather than from what the app draws. That is 42 rules and 3.2 kB, byte-identical in every project here, of which
**41 to 42 were referenced by nothing at all**.

Those are now dropped whether or not `pruneUnusedTokens` is set. The flag exists because a token can be reached by a
name the pass never sees — `token.var()` with a path assembled at runtime, a stylesheet outside `include`, a package
consuming the output as design tokens. A registration has no such surface: nothing hands one to JavaScript and none are
part of the `token()` api, verified as zero overlap with declared tokens. Whether the finished stylesheet mentions one
is the whole question, so opting out of the half that cannot be proven should not mean carrying the half that can.

Turning `pruneUnusedTokens` off is still exact for token declarations — every one is kept.

**Upgrading**

The three cases the reachability pass cannot see are unchanged and are the ones to check if a value goes missing:

- a token named by a path the source does not spell out as a string literal, such as `token.var(key)`
- a token referenced only from a stylesheet outside `include`
- a token consumed by a separate package treating the output as design tokens

List those under `staticCss`, or set `pruneUnusedTokens: false`. The equivalent for an animation name assembled at
runtime is already covered — the keyframe pass falls back to a deliberately over-inclusive textual scan of `include`.
