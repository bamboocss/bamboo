---
'@bamboocss/shared': patch
'@bamboocss/vite': patch
---

Report a surviving recipe reference where it actually is, and make diagnostic truncation raisable.

- **`runtime-binding` pointed at the wrong file and an impossible line.** The surviving reference is found through the
  project-wide symbol graph, so it is usually in a module other than the one being folded. Its offsets index that file
  and were reported against the folded one, which produced a line number derived from text that does not contain it —
  `app/styles.ts:841` on a file with fewer lines than that. The reference's own file and line are now carried and
  reported, so the message names the call site that has to change rather than the declaration.
- **`BAMBOO_DIAGNOSTIC_LIMIT` raises the findings cap**, or set it to `all` for every one. A capped list is right for
  reading one failure and wrong for scoping a migration: "… and 13 more files" left no way to drive the list to zero
  except by fixing what was shown and rebuilding to reveal the next batch. It overrides a caller's explicit limit too,
  and a malformed value falls back to the default rather than replacing the diagnostic with a complaint about the
  variable.
- **The unimported-stylesheet error now says the import has to be JavaScript.** `@import 'virtual:bamboo.css'` from a
  stylesheet fails as an unresolvable path, because Vite resolves CSS `@import` before plugin resolution. The previous
  wording sent people to try it.
- **Documented what actually decides whether an inline recipe compiles**: every reference to the binding has to be a
  compiled call. Neither the declaring module nor a runtime variant selection is what fails — reading the binding itself
  is, since the declaration is erased.
