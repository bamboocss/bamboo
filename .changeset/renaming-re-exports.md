---
'@bamboocss/extractor': patch
---

Resolve values through renaming re-exports.

Export lookup compared a requested name against the name in the _source_ module rather than the one the module actually
exposes, so `export { btn as button } from './styles'` failed in both directions:

- Importing `button` — the name the barrel really exports — resolved to nothing, and the style silently vanished from
  the CSS. Renaming re-exports are ordinary barrel hygiene, so this is the one that bites.
- Importing `btn` — a name the barrel does **not** export — resolved anyway. TypeScript already rejects that import, so
  it only affected code that does not typecheck. **If you were relying on it, those styles will now disappear**; import
  the name the barrel exposes.

A value declared locally and renamed on the way out (`const btn = …; export { btn as button }`) now resolves too, and a
star re-export sitting over a renaming barrel forwards correctly.

Lookup carries the source name across each hop, so the cycle guard added alongside it now tracks file-and-name pairs.
Keyed on the file alone, a file searched unsuccessfully for one name would have blocked a later search of that same file
for a different one — a value that is genuinely reachable.
