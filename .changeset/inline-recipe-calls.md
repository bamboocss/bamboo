---
'@bamboocss/parser': minor
'@bamboocss/core': minor
'@bamboocss/vite': minor
'@bamboocss/types': minor
---

Report calls of inline recipes, which the build previously could not see at all.

An inline recipe is one you bind yourself rather than declaring in the config:

```ts
const badge = cva({ base: { rounded: 'full' }, variants: { tone: { info: { bg: 'blue.100' } } } })

badge({ tone: 'info' }) // ← this call
```

Bamboo recognises style calls by the name they were _imported_ as, and `badge` is not an import. So while the `cva(...)`
definition was extracted normally — the CSS was always correct — the **invocations** were never looked at. They were
absent from the transform's coverage summary and from `reportSkipped`, which meant a call the fold could not handle was
indistinguishable from a call nothing had parsed, and the reported percentage read higher than a project's real
coverage. They now appear as the skip reason `recipe-call`.

The summary's denominator is `folded + declined`, so invisible calls inflated it directly. `sandbox/vite-ts` reported
`Folded 33/41 (80%)` and now truthfully reports
`Folded 33/43 (77%) — declined: dynamic=4 empty=2 not-foldable=2 recipe-call=2`. **Expect your coverage number to go
down**; nothing about the build got worse.

**Nothing changes for the ordinary case.** The rules already came from the definition; this records a call site, it does
not encode one. Output differs only for a recipe whose name collides with another surface, tabulated below — and only by
dropping rules nothing referenced.

**Reported, not folded, and it does not fail `strict`** — an inline recipe keeps the recipe runtime rather than the
`css()` engine, which is the thing `strict` exists to drive to zero.

Only a **module-scope `const`** binding is registered, and only when its initializer resolves to the imported
`cva`/`sva` — so a project's own `cva` helper is not picked up, and a `let` that could be reassigned to something else
is not either. Module scope is the load-bearing part: a name is registered per file rather than per binding, so a nested
`const css = cva({ … })` shadowing the `css` import would make the module's real `css()` calls look like recipe calls
and emit no rules for them. A recipe declared inside a function rebuilds itself on every call anyway, and its rules come
from the `cva(...)` definition regardless.

**Where CSS output differs.** A module-scope recipe whose name is one the file already matched was previously routed to
that other surface, and the variant selection at its call site read as props for that surface. Swept across every
pattern key, every recipe key, and every bare-matched name, in each import context:

| a module-scope `const N = cva(...)` where…        | what is no longer emitted                       |
| ------------------------------------------------- | ----------------------------------------------- |
| `N` is an ordinary name — the common case         | nothing; output is identical                    |
| `N` is `sva`, `token`, `viewTransition`, `cx`     | nothing; those misroutes were never CSS-bearing |
| `N` is `css`                                      | atomic rules built from the call's argument     |
| `N` names a pattern, via a namespace import       | that pattern's full default output              |
| `N` names a config recipe, via a namespace import | that recipe's whole rule set, base and variants |

The `css` case is the reachable one — it needs no namespace import, because the name `css` is matched whatever a file
imports. It is also the one whose removed rules look legitimate: `css({ color: 'blue.300' })` emitted `.c_blue\.300`
before. Nothing rendered it. The call invokes a recipe, and a recipe names its classes from its config, so any rule
derived from reading its argument as style props was unreferenced.

**Rules are only ever removed — the swept "added" set is empty in every case** — and each removal is a correction.
Regenerating every codegen scenario from a fresh build produces **zero artifact drift**, which also rules out a cascade
through token and keyframe pruning.

**One way you could notice a loss.** Mis-dispatching a call also marked that config recipe as _used_. A project that
renders a config recipe through a path the parser cannot see — a runtime import, a computed `className` — and was
accidentally kept alive by sharing its name with a local recipe will now lose those rules. Reach for
[`staticCss`](https://bamboocss.com/docs/references/config#staticcss), which is the supported way to force emission.

**Perf-neutral**, measured rather than assumed. The pass that finds these bindings has to run before extraction, since
`matchFn` is memoized per name. Written as a recursive walk it cost **~10%** of extraction on every file, and 13% on
files defining recipes. Restricting it to module scope makes it a walk of the top-level statement list rather than of
the tree, gated on the file importing `cva`/`sva` at all — measured at parity on `extract-modes` (1.02x / 1.00x, in a
back-to-back A/B whose control moved less than the effect).
