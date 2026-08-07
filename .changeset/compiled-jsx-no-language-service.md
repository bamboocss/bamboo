---
'@bamboocss/extractor': patch
---

Resolve a locally-declared callee lexically instead of through the language service.

Every call expression is offered to the compiled-JSX runtime matcher, and a callee that is not in the file's import map
fell through to `identifier.getDefinitions()`. That is a language-service query: the first one forces
`synchronizeHostData` -> `createProgram`, which resolves, parses and binds the whole transitive `.d.ts` closure of the
project.

The fallback runs for the most ordinary shape in application source — `const badge = cva({…})` followed by
`badge(props)`, or any local helper — and even for a callee that is never declared at all. In a five-file sandbox it
built a 161-file, 5.1MB program, most of it `node_modules`; the size tracks the dependency graph rather than the user's
source. Inside a bundler that program is built in the same heap as the module graph, which showed up as an extraction
step that went from ~3s to ~24s and then ran out of memory.

Since `resolveCallee` matches against the imports first, the declaration being looked for is always in the same file, so
a walk out through the enclosing scopes replaces the query with no change in what resolves.

Measured on one file containing a single locally-declared call site:

| project        | before        | after     |
| -------------- | ------------- | --------- |
| 5-file sandbox | 498ms, +123MB | 3ms, +0MB |
| 96-file site   | 770ms, +137MB | 4ms, +0MB |
