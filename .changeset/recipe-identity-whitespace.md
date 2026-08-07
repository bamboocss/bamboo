---
'@bamboocss/shared': patch
---

Fix an inline `cva`/`sva` losing every style when a declaration value contains repeated whitespace.

An inline recipe's classes are named from a hash of its config, derived independently by the build and by the browser.
The build never sees the config as written: `maybe-box-node` reads every string literal through `trimWhitespace`, so
`'calc(100vh -  16px)'` is `'calc(100vh - 16px)'` by the time it reaches the encoder. The browser holds it as authored.

The two therefore hashed different objects and derived different names, so the element carried a class the stylesheet
had no rule for and rendered with **none** of the recipe's styles. Nothing warned.

```ts
cva({ base: { minHeight: 'calc(100vh -  16px)' } }) // build: cva_fepkUe, browser: cva_kOwuny
cva({ base: { color: 'rgba(0,  0, 0, 0.5)' } }) // build: cva_idlHhr, browser: cva_gCkUyn
cva({ base: { padding: '12px  16px' } }) // build: cva_jkWnrH, browser: cva_cINWCv
```

The identity now collapses whitespace in string values before hashing, with `trimWhitespace`'s own regex rather than a
second spelling of it. Two configs differing only in repeated whitespace produce identical CSS and now share a name,
which is what the stylesheet already assumed — the build emits one rule for both.

**No emitted CSS changes.** Every build-side name is what it was; only the browser's derivation moves onto it.

Worth knowing about the failure mode, because it defeats the obvious checks: the orphaned name leaves no unused rule
behind. A config that collapses onto an existing one is byte-identical to it, so the stylesheet has exactly the rules it
should and only the _runtime_ asks for something absent. Diffing the stylesheet, or looking for dead rules, finds
nothing.

`checkNamingAgreement` did not catch it either, and still would not: it compares the two derivations for a fixed canary,
which cannot see a divergence introduced by how a particular call site was written. Setting `className` on the recipe
remains an effective workaround for any such divergence, since the identity then short-circuits on the name and never
hashes the config at all.
