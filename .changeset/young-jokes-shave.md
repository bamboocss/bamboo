---
'@bamboocss/vite': patch
---

Bring the documentation back in line with what the compiler now does.

- **Class names in every example were the compact format that no longer exists.** Six pages showed `'_4p9d _7bc2'` as
  what a compiled call emits. Since `denseClassNames` was removed, a compiled call emits the semantic atom names, or
  hashed ones when `hash` is on.
- **`renameCssAsset` and `BAMBOO_DIAGNOSTIC_LIMIT` were undocumented**, both added recently. The first now explains why
  it exists — `[hash]` is expanded before pruning, so the name describes the stylesheet as it was beforehand — and that
  turning it off skips the pruning too, rather than only the rename.
- **Pre-rendering guidance described a setting that is gone.** It said to use stable compact names when server and
  client are built separately. Names are now derived from the declarations themselves, so the two agree without
  coordination.
- **`hash` was described as extraction-only** in two places, written while a second Vite-only shortening layer existed.
  It is now the only thing that shortens names, and it applies to every build path.
