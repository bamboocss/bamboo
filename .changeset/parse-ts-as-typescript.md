---
'@bamboocss/parser': patch
---

Parse `.ts` files as TypeScript instead of TSX, so styles written after a generic arrow are extracted.

Every file was handed to the parser as `ScriptKind.TSX`, which is not a superset of `TS` — the two disagree wherever `<`
is ambiguous. Under TSX a generic arrow `<T>(value: T) => value` and an old-style assertion `<HTMLElement>document.body`
parse as a _JSX element_, whose children then swallow the rest of the file.

Nothing looks wrong: the source is valid TypeScript, the bytes are untouched, and no error is reported. But every
`css()`, `cva()` or `token()` call below that line has stopped existing as far as extraction is concerned, so its rules
are silently never emitted.

Only `.ts`, `.mts` and `.cts` change. A `.ts` file cannot legally contain JSX, so parsing one as TSX could only ever
mis-parse. `.js` and `.jsx` keep parsing as TSX because they routinely carry JSX in projects that never adopted
TypeScript, and `.vue`/`.svelte` keep it because they are stored as tsx after `parser:before` rewrites them.

Verified byte-identical CSS output on the example apps, which use `.tsx` throughout.
