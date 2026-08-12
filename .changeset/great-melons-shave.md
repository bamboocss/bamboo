---
'@bamboocss/vite': patch
---

Correct the `runtime-binding` guidance, which described a constraint 1.36.0 removed.

Until 1.36.0 the declaring module answered for references it found anywhere in the project, so an exported inline recipe
failed even when every consumer compiled cleanly. The message and the recipes page both told people the fix was to move
the recipe into `theme.extend.recipes` — and at least one team migrated every shared recipe in their application on that
advice.

Since 1.36.0 each module answers only for its own text. Calling an inline recipe from another module compiles like any
other call; what fails is _reading the binding_ rather than calling it — `const alias = badge`, `badge.raw(...)`, a bare
re-export — because the declaration is erased and the value is `undefined`. The message now says that, and names the
read as the thing to change.

The recipes page carried a section asserting the old constraint outright, and its comparison table said an inline recipe
could not be imported by another module. Both are corrected, and two rows of that table that a previous edit had
absorbed into the surrounding prose are restored.
