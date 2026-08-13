---
'@bamboocss/vite': patch
---

Stop pruning the stylesheet against half a build.

A project on Vike reported rarely-used classes silently not applying — `md:{display:inline-block}` among them — with
**39% of its atoms missing** from the stylesheet its pages link. The workaround was
`bamboocss({ renameCssAsset: false })`, which disables pruning outright.

**The sheet is pruned when the environment that imports it finishes, which is not when the build finishes.** An SSR
framework builds a client bundle and a server bundle. The client imports `virtual:bamboo.css`, so the client's
`generateBundle` is where the stylesheet is finalized — and the client builds _first_, before the server environment has
transformed a single module. Reachability is therefore incomplete at exactly the moment it is used to delete rules, and
every atom only the server graph reaches loses its rule from the one copy that ships. The sheet is emitted once, not
twice.

Pruning now waits until every environment of the run has been compiled. Being last is not the common case — frameworks
build the client first — so those builds now ship the full extracted stylesheet, and print one line saying which
environment they are still waiting on. That is the same output `renameCssAsset: false` produces, so the workaround can
be dropped without the sheet changing size. A framework that builds its server bundle first does get pruned output.

**A second cause, found while reproducing it: there was no shared session to accumulate into.** Vite re-reads the config
file once per environment and calls the plugin factory again, so a project listing `bamboocss()` in `vite.config.ts` —
every project — got a _fresh instance per environment_, each with its own compilation session, context and ts-morph
project. Nothing an environment established could be seen by the next one. Both plugins now declare
`sharedDuringBuild: true`, which is the premise the 1.37.2 fix was already written against. It also means the config
load, extraction and parse happen once per build rather than once per environment.

Verified by probing Vite directly: with the plugin coming from a config file, a plugin without the flag reported
instance #3 for the client environment and #5 for ssr; with it, one instance served both.

**Where the run does not say how many environments it has, the build fails rather than ships.** `vite build` announces
them, and so does any config setting `builder`. A script calling `builder.build(environment)` itself announces nothing,
and the first environment cannot know it is not the last — so it prunes, and the next environment throws when it finds a
class it just compiled already pruned out of a finalized sheet. The message names the classes and the three ways to fix
it. Green build, real class names in the markup, unstyled elements is the failure this whole change is about; it is not
worth trading one path back into it.

**A third, found by testing the order that now works.** The two strict-build guards — "compiled classes were produced
but `virtual:bamboo.css` was not imported", and "compiled modules are outside the CSS extraction graph" — both read
state that only the environment serving the stylesheet fills in, and both ran at every environment's `buildEnd`. Asked
of an environment that builds before that one they are not early but wrong: a build with the server bundle first failed
with "virtual:bamboo.css was not imported" for a client bundle importing it on the next line. They are statements about
a finished run, and now wait for one.

Also: `session.sourcemap` was written by every environment's `configResolved` and read at `generateBundle`, so with one
shared instance a rename could rewrite chunk text against another environment's sourcemap mode. It is now read from the
environment being generated.

What this does not do is recover pruning for client-first SSR builds. Doing that needs per-file attribution of extracted
atoms, so that atoms from modules outside the current environment's graph can be held back while everything else is
still pruned — the recipe-variant explosion, which is the bulk of what pruning removes, is attributable to modules that
_are_ in the graph. That is a change to the encoder and the extraction pass, and it is not this one.

Emitted CSS is unchanged for a single-environment build, measured rather than reasoned: a real `vite build` of a fixture
using `css()`, a recipe with a variant nothing selects, a condition and a pseudo-element, taken before and after on the
same tree. The stylesheet is byte-identical (1,151 bytes, same SHA-1), the asset name — which carries a hash of the
pruned bytes — is unchanged, and so is the emitted JS. The unselected variant is still pruned, so pruning is running,
not merely producing the same output by being skipped.

Nothing on a per-module path moved, so `fold.bench.ts` does not apply; the added work is one set difference per
environment at `generateBundle`.
