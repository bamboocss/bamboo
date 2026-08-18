---
'@bamboocss/vite': patch
---

Leave a folded consumer alone when the edit does not change the bytes it compiles to.

Editing a shared style module re-transforms everything that folded a value out of it, and most of those re-transforms
recompute the bytes they already had — an edit to one export moves the consumers reading _that_ export, not the ones
reading something else from the same file. Each of those cost a full re-transform through every plugin in the chain,
plus an HMR announcement for a module the browser already holds verbatim, plus whatever a framework does per announced
module (react-router calls `reloadModule` once per entry, in both its client and its ssr pass).

`hotUpdate` now re-folds each dependent and compares a digest of the result against what its last transform produced. A
match means the module is neither announced nor invalidated; anything else — no recorded signature, a file that will not
read, a fold that throws — is treated as changed, which is what this path did before.

Safe by what "identical" means: the invalidation exists to drop a compiled class string that no longer matches its
source, and when recompiling produces the same string there is nothing stale to drop. It also only ever withholds a name
Bamboo added, never one of the modules Vite matched, so a consumer that imports the edited module for a runtime value is
still reached by Vite's own propagation exactly as before.

Measured on a twenty-consumer fan-out of one shared module, per edit: editing a runtime value no fold reads went from 22
Bamboo transforms to 2, editing one variant arm from 22 to 12, and editing the recipe base — where every consumer really
does move — stayed at 22.
