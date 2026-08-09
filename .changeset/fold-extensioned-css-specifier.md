---
'@bamboocss/vite': patch
---

Fold partially-static calls in files that import the css module with an explicit extension.

`outExtension: 'js'` under NodeNext resolution makes a file write `styled-system/css/index.js`, which the fold's module
check compared against a bare `styled-system/css` by equality or tail — matching neither. Extraction was unaffected,
since `ImportMap.match` is substring-based, so the call folded while the `cx` insert was refused and the result was
reported as `dynamic`. A project spelling the import that way lost partial folding in every file at once, with nothing
in the diagnostics to distinguish it from a genuinely dynamic call.

The specifier is now reduced to the module it names before comparison, stripping a module extension and a trailing
`/index`. The equality the check is built on is unchanged: a sibling module such as `styled-system/css/css` still
matches nothing, so `cx` is still never added to a module that may not export it.
