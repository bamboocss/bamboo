---
'@bamboocss/vite': patch
---

Stop losing the stylesheet under Rolldown, and compile recipes in files that import the generated helpers by subpath.

- **A Rolldown build shipped no stylesheet and exited 0.** The late asset rename replaces an entry in `bundle`, which
  Rolldown does not support — it logs that the assignment is ignored and drops the asset, so `dist/` contained no
  generated CSS at all and the app rendered unstyled. The rename is now skipped when Rolldown is detected, keeping the
  pruned bytes under Vite's own content hash.
- **A lost stylesheet is now a hard error rather than a green build.** If modules were compiled to Bamboo class values
  and no emitted asset carries the generated sheet, `generateBundle` fails — the same spirit as the existing
  unimported-`virtual:bamboo.css` check. Any other plugin that drops or replaces the CSS asset is caught by it too.
- **`renameCssAsset: false`** opts out of the rename explicitly, for a framework that relocates assets itself and loses
  track of the new name — react-router's SSR build among them.
- **Importing the generated helpers by subpath no longer fails every runtime recipe selection.**
  `import { cva } from 'styled-system/css/cva.js'` gave the compiler no import declaration to attach `cvaMap` to, since
  that module does not export it, so the calls declined under a reason that said nothing about imports. The helper is
  now imported from the sibling module that does export it, preserving the caller's spelling and extension.
- **`runtime-binding` explains itself.** The message now says the value was read outside a compiled call, that an inline
  recipe imported by another module is the usual cause, that the fix is a config recipe, and that the location given is
  the reference rather than the declaration. Every diagnostic also points at `BAMBOO_DIAGNOSTIC_LIMIT=all`.
- **Documented that an inline recipe cannot be shared across modules**, as its own section on the recipes page rather
  than a row reading "can be shared in a preset".
