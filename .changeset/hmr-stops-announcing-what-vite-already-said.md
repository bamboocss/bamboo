---
'@bamboocss/vite': patch
---

Stop re-announcing HMR updates Vite is already sending.

One `css()` edit to a module two routes share moved **554 kB** over the dev socket on a five-route react-router app.
`root.tsx` and `dashboard.tsx` were each fetched five times, at ~46 kB a copy, and the stylesheet twice — 469 kB of the
554 was duplicates of the other 85. Extraction in the same log took 2.49 ms, so essentially none of the wall clock was
Bamboo doing work. It is now **331 kB** and 9 responses instead of 14, with the same modules re-transformed and the edit
applying in the same time.

Two places announced something Vite had in hand:

- `hotUpdate` returned the modules that folded a value out of the changed file, alongside invalidating them.
  Invalidating is the actual fix — Vite _soft_-invalidates a static importer, and a soft invalidation keeps the cached
  transform, which is where the compiled class string lives. Naming them as well is redundant, because `addWatchFile`
  already makes each one a direct importer, so `propagateUpdate` reaches all of them by itself. It is also not free: a
  framework plugin reading the result re-drives HMR _per entry_ — react-router's
  `react-router-server-change-trigger-client-hmr` calls `reloadModule` once per module, in both its client and its ssr
  pass — so every extra name was another full round trip. Eight `hmr update` messages for one edit; now three, of which
  two are react-router duplicating Vite.
- The dev watcher forced a reload of the virtual stylesheet for every extracted file. `vite:css-analysis` turns the
  `addWatchFile` calls in `load` into real importer edges, so the sheet is already a direct importer of every file the
  extractor read and Vite propagates an edit to it unprompted. Forcing one as well is a second `updateModules`, which
  the browser answers by refetching the whole stylesheet again — 36 kB a copy, per keystroke.

Both now defer when Vite has matched a module for the changed file, and both still fire when it has not: a dependency
the fold read that never became a module of its own is the case they were written for, and nothing else would repaint at
all.
