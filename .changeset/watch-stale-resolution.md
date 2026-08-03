---
'@bamboocss/extractor': patch
'@bamboocss/parser': patch
'@bamboocss/node': patch
---

Serve fresh values to importers after a shared style file is edited or deleted.

Resolved values are memoized against the AST node that produced them, but a node's value can come from another file —
`css(button)` folds whatever `./styles` exports. Editing that file replaces only its own nodes, so an importer's nodes
stayed identical and kept serving the value read before the edit. Re-parsing the importer was not enough to clear it.

The memo is now dropped whenever a file's contents are replaced or reloaded, which is the point at which another file's
resolutions can have gone out of date. Deleting a shared file also rebuilds its importers, resolving them before the
file leaves the project rather than after, when its path can no longer be matched.
