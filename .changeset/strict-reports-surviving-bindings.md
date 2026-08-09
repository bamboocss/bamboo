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

Two consequences worth expecting. A module that keeps any other value from the css module — `fallback(...)` inside a
`cva` config, or `recipe.variantKeys` — now fails `strict` where it passed before; that is the check working, since
those imports retain the engine, but it is a build that used to be green. And a _partial_ fold writes its runtime half
into the output rather than the module's AST, so a surviving `css(...)` there is still neither folded nor reported —
unchanged by this, and the remaining gap in the guarantee.

Off unless `strict` is on. The walk measured ~5x on the per-module fold of a 400-line module that imports bamboo; a
module that imports none of it costs nothing, since the check returns before walking. Default builds are unaffected.
