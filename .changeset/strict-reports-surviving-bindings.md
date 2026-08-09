---
'@bamboocss/vite': minor
---

Make `strict` answer the question it claims to.

`strict` failed a build on entries in the skip ledger, and the ledger holds only calls something recognised — so the
guarantee was worth exactly what the recogniser was, and said nothing about the rest. A shape nothing looked at appeared
in neither the folded nor the skipped column, and the build passed while the module still imported the engine. That is
how a project shipped ~380 runtime recipe calls under a clean `strict` run.

Under `strict` the fold now also reports bindings the rewrite left behind: a value imported from a bamboo module that is
still referenced once every replacement is applied, whatever the ledger says. It catches a binding passed on rather than
called, one handed to a function the build cannot follow, and a module whose only bamboo usage produced no parser result
at all — each of which used to be skipped before the fold saw it.

It also covers `export { css } from 'styled-system/css'`, which keeps the engine without importing it — the shape a
wrapper module takes.

Reported as `runtime-binding`, and only where the ledger already fails on that binding: a call declined as `dynamic`
needs no second complaint, while one declined as `not-imported` or `not-foldable` passes the build and so must not
suppress anything. The helpers the fold itself writes (`cx`, `cvaPick`, `splitProps`, the leaf helper) are excluded,
since they live in `cx` and pull no engine — as are `cva` and `sva`, whose definitions keep the recipe runtime rather
than the css engine and which `strict` has always accepted.

Only genuine value references count. A name is also an intrinsic JSX tag, an object key, a property, a method and a
declaration, and `button`, `input`, `label`, `select`, `table`, `dialog` and `form` are all ordinary recipe names — so
counting every identifier failed builds on modules that had folded completely, because of their markup. Type positions
are excluded too: they are erased, and the import with them.

A partial fold is covered too, and it needed saying separately: it writes its runtime half into the output through
magic-string rather than into the module's AST, so the walk cannot see it — and the call produced no skip entry in the
first place, because it _did_ fold. Splitting `css({ color: 'red.300', _hover: { color: tone } })` still leaves
`css({ _hover: … })` in the bundle. The plan now reports that half. A split that leaves no call behind reports nothing.

What is still not reported is a reference _inside_ a rewritten call — a partial fold copies its dynamic half and its
ternary conditions across verbatim, so a bamboo binding mentioned there survives unreported. That is deliberate rather
than pending: the check ignores everything inside a range it rewrote, and narrowing that to the text actually removed
would report bindings the fold had resolved away, such as a `token(...)` folded into the static half. A false failure on
a module that folded correctly is worse than a missed one, for a gate with no per-call override.

Expect builds that used to pass to fail, in three shapes: a partial fold with a dynamic remainder (above); a module
keeping any other value from the css module, such as `fallback(...)` inside a `cva` config or `recipe.variantKeys`; and
a wrapper module re-exporting the css API. Each genuinely retains the engine — `strict` was wrong before, not now — but
each is a green build turning red on upgrade. `strict` is off by default and this changes nothing for builds without it.

Off unless `strict` is on. The walk measured ~5x on the per-module fold of a 400-line module that imports bamboo; a
module that imports none of it costs nothing, since the check returns before walking. Default builds are unaffected.
