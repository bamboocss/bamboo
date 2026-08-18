---
'@bamboocss/vite': patch
---

Announce a folded consumer when the module it read from accepts itself, instead of invalidating it and telling nobody.

The fold compiles a class into the module that _calls_ a recipe or shares a style object, so editing the module that
value came from has to re-transform its consumers. Those consumers are hard-invalidated on the way out — Vite only
_soft_-invalidates a static importer, which keeps the cached transform, and that cache is where the compiled class
string lives.

Naming them back to Vite was gated on `modules.length`, on the reasoning that `addWatchFile` has made each consumer a
direct importer, so Vite's own pass walks to them and sends the same update. That is true right up until the changed
module accepts itself: `propagateUpdate` stops at the first self-accepting module and never walks its importers, and
React Fast Refresh makes every file exporting a component self-accepting. Editing a component that a sibling folds a
class out of therefore invalidated the sibling and announced nothing, and the browser kept running the class compiled
from the previous contents until a full reload — with Vite and Bamboo both logging as though the edit had landed. It
also made the fan-out look cheap in React apps, when it was only deferred.

The gate is now on whether Vite's walk will actually arrive rather than on whether it has anywhere to start: one
non-self-accepting module is enough for it to reach the consumers, so the duplicate updates that gate was added for are
still avoided. An empty list keeps its old meaning. The existing fixture could not catch this because its dependency is
a plain module, which does propagate outward; the new test uses a self-accepting one.
