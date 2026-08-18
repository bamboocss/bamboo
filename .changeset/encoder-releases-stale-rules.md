---
'@bamboocss/core': patch
'@bamboocss/parser': patch
'@bamboocss/node': patch
---

Drop a file's old rules when it is read again, instead of keeping every version it ever had.

`StyleEncoder` only ever added. It is built once with the context, a context outlives rebuilds, and nothing on it could
remove a hash — so a long-lived process accumulated: each save of an edited file put its new atoms in and left the
previous version's behind, for the life of the dev server. The orphans were valid CSS and internally consistent, which
is why nothing caught them; one session ended with 22 classes no element could ever carry.

Every parse is now attributed to an owner, and reading the same file again replaces what its last reading encoded rather
than adding to it. Ownership is refcounted per hash, so a declaration two files share survives one of them dropping it;
asking the question any other way would mean scanning the project on every keystroke, which is the cost the mechanism
exists to avoid. The retain of the new reading runs before the release of the old one, so a declaration a file keeps
across its own edit goes 1 -> 2 -> 1 and never passes through the zero that would delete it. All five collections are
covered — atomic styles, recipe variants, recipe bases, compound variants and view transitions — as are the utility
atoms a static build interns for a recipe, which an inline `cva` renames on every edit of its styles.

Two things are deliberately never released. Anything encoded outside a file — a `staticCss` safelist, a restored encoder
dump — answers to config rather than to source, so no file may take it away. And the extraction pass and a bundler
transform hold their readings of the same module separately, because the two can legitimately see different source and
neither should be able to narrow the other.

Deletion is covered only where the encoder that emits the stylesheet is the one told about the delete.
`Project.removeSourceFile` now releases the file, which reaches `bamboo --watch` and the PostCSS-driven watch — both
call it on the context they go on to build from. The Vite dev server does not: its two plugins hold a `BambooContext`
each, and `watchChange` releases on the compiler's while the stylesheet comes from the CSS plugin's. A file deleted
under `vite dev` keeps its rules until the process restarts, exactly as before. That split predates this change and is
left alone here.

`bamboo --watch` is improved rather than finished, for a related reason. Its first pass reads every file through
`parseFiles` and each rebuild re-reads only the changed ones through `parseSourceFile` — different entry points, so
different owners, and the first reading is never replaced. A watch session is therefore bounded at two readings of a
file rather than one per keystroke, which is not yet "the last reading replaces the one before it".

Build output is unchanged. Every file is read once in a build, so nothing is ever released and no ordering or content
can move: verified byte-identical across the emitted stylesheets of every sandbox, through the CLI and through a Vite
production build, with the generator artifacts regenerating identically.

Per-edit cost is unmeasured. The machine available ran at load 12–16 throughout, where run-to-run spread on the
extraction benchmarks exceeds any effect this could have — a reading taken there would be noise reported as a result. A
benchmark for the path this adds is included (`extract-modes`, `css() calls, re-read into the same encoder`), so the
measurement can be taken on a quiet machine.
