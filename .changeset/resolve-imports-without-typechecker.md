---
'@bamboocss/parser': patch
---

Resolve imports without initializing the type checker when building the dependency graph.

Tracking which files import which ran through the symbol table, which forces the TypeScript type checker to initialize
on first use — hundreds of milliseconds on a cold build, for what is only a filesystem question. Resolution now goes
straight to the module resolver, with a shared cache so a repeated specifier does not hit the disk again.

Resolved files are looked up in the project rather than added to it, so resolving a package import cannot pull its type
declarations in. The graph continues to track only the files being scanned.
