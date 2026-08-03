---
'@bamboocss/node': patch
'@bamboocss/parser': patch
---

Build the stylesheet once per edit, not once per affected file.

The stylesheet is built from the whole parser result, so rebuilding it per file meant one edit to a shared style file
ran the full optimize pipeline and wrote to disk once for every file importing it — 61 builds and 61 writes for a file
with 60 importers. Affected files are now re-parsed first and the sheet is built and written a single time.

A file appearing also reaches the files that were importing it before it existed. Those importers have no dependency
edge to follow, since the specifier resolved to nothing when they were parsed, so they are tracked separately and
rebuilt when a new file arrives.
