---
'@bamboocss/vite': minor
---

Restart the dev server when `bamboo.config.ts` changes, the way Vite does for its own config.

Nothing told Vite that file mattered. `watch` is the CLI's own watcher, and a project running `vite dev` never reaches
it — so editing a token, which is the thing a designer iterates on most, did nothing until something else happened to
touch a source file, and the instruction was to restart the server by hand.

A restart rather than a re-emitted stylesheet, because the integration holds two contexts — the CSS plugin's `Builder`,
which reloads its config, and the compiler's, which does not. A token _value_ edit therefore came out right on the next
source change, while an edit that changes what compiles — adding a token, a condition, a utility — left the compiler
naming classes from the old config against a sheet emitted from the new one. Half-updated is worse than stale.

Declared through Vite's own config-file list rather than a watcher of Bamboo's. That list is what reaches a config
_outside_ `root` — a monorepo with one config above `apps/web`, or a preset resolved into `node_modules`, neither of
which the project watcher covers — and it makes the restart Vite's, with its concurrency guard and its error reporting
rather than a second copy of both. The config's import graph is included, so editing a preset restarts too.
