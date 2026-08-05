---
'@bamboocss/core': patch
---

Remove `StaticCss.parse`.

It had no callers anywhere — not in this repo, its sandboxes, the playground or the docs — and was never documented. The
private `createRegex` behind it existed only to serve it. It was stranded by the 2024 static-css engine refactor, which
stopped returning either from `process()`, and has been unreachable in practice ever since: hooks receive a curated
interface that `staticCss` is not on.

That it was broken is the clearest evidence nothing called it. `matches.map((m) => m.replace('.', ''))` strips the first
dot anywhere in the string, and generated class names contain dots — so it would have handed back `c_red300` for
`c_red.300`.

Worth removing rather than leaving: it built a regex alternation over every class name the decoder knows and recompiled
it on every call, so the first thing to reach for it would have paid for the whole stylesheet per invocation. Deleting
an uncalled method is perf-neutral by construction, so there is no measurement to report.

The method was declared in the published types, so this is a removal from `@bamboocss/core`'s surface rather than from
its internals. Filed as a patch, matching how this repo has treated removing an undocumented binding before — the
package has no README, and the docs never reference it.

`decoder.classNames`, the state it read, stays reachable through the hooks API.
