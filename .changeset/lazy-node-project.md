---
'@bamboocss/node': patch
'@bamboocss/parser': patch
'@bamboocss/extractor': patch
'@bamboocss/core': patch
'@bamboocss/vite': patch
'@bamboocss/dev': patch
---

Defer a context's initial parser source loading and AST creation until its Project first performs a source-graph
operation. Source-read, ts-morph Project construction, and AST construction errors now surface on that first source
operation rather than during context construction. Standalone parser Projects stay eager with their native mutable
raw-project property; the context-only deferred wrapper exposes its raw ts-morph Project through a materializing
non-configurable accessor whose setter remains the supported replacement boundary. During its atomic preload, every
public wrapper entry rejects reentrant access before exposing live state or invoking callbacks.

Route every Bamboo cross-file value, helper, re-export, and imported-recipe lookup through a Project-owned resolution
ledger. Local sources outside `include` are loaded on demand, external packages remain outside the source graph, and
every semantically traversed local source runs `parser:before` once per source revision before extraction or ledger
publication, so consumer-first and dependency-first parsing agree. Reverse dependencies reflect that exact effective
AST. Missing local `paths`, `baseUrl`, package-import, and package-self targets remain pending across add/remove cycles,
and successful local fallbacks retain missing higher-priority candidates so an add event redirects their importers,
while external packages stay outside the graph. The parser exposes internal, read-only resolution facts and
resolved-source paths for transactional Node consumers; extractor callers that need cross-file traversal can supply the
same resolver through `BoxContext`.

Keep incremental extraction and CSS output aligned with that ledger. Builder, CLI watch, and Vite now invalidate the
complete semantic dependent closure—including excluded local helpers and resolution-config changes—without treating
runtime-only imports as style dependencies. Recreated files and higher-priority alias targets are detected, removed
files regenerate CLI output, client/SSR query variants retain their own cached dependency facts, and file-owner order is
reconciled against the current inventory so incremental CSS remains byte-identical to a clean build.
