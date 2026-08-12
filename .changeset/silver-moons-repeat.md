---
'@bamboocss/parser': patch
---

Stop treating a re-add of a file's own text as an edit.

A bundler adds every module to the project before parsing it, handing back the text the extractor already read off disk.
Measured on a 6,307-file Vite build, **6,001 of 6,001** `addSourceFile` calls from the Vite transform passed
byte-identical content — none differing, none absent. Each one paid twice: `createSourceFile` overwrites, which
re-parses the file and forgets every node previously taken from it, and `invalidate` drops both caches memoized against
_other_ files' contents.

The second is what hurt. The imported-recipe walk runs one line later, inside `parseSourceFile`, so emptying its memo
here meant every module re-walked the whole export closure of every barrel it imports — the opposite of the "a barrel
imported by two hundred files is walked once" the cache exists for. `addSourceFile` now returns the existing
`SourceFile` when its full text already equals the incoming content, invalidating nothing.

On that build:

|                     | before                | after                 |
| ------------------- | --------------------- | --------------------- |
| `walkExports` calls | 1,866,610             | 36,610                |
| module resolutions  | 3,734,123             | 98,123                |
| build wall-clock    | 62.6s / 48.1s / 47.6s | 35.7s / 29.9s / 30.5s |

Three alternating A/B pairs, ratio 0.57 / 0.62 / 0.64 — **a ~38% shorter build**. Ratios rather than seconds because the
machine was under load and the absolutes swung 40% for the same tree; the call counts do not depend on load. Emitted CSS
is byte-identical (3,611 bytes both arms) and the asset names, which carry content hashes, are unchanged.

The comparison is textual, not semantic, so a whitespace-only edit still invalidates. A file whose text `parser:before`
replaced no longer matches its own source, falls through, and is overwritten exactly as before.

`packages/vite/__tests__/fold.bench.ts` is unmoved (every case within noise, controls +1.1% and +1.7%) and cannot see
this either way: it hands out a fresh path per iteration, so the file never already exists and the guard never fires.
The two new tests in `packages/parser/__tests__/watch-invalidation.test.ts` count resolutions rather than timing them,
so the guarantee holds in CI — without the guard the second consumer of a barrel costs exactly what the first did.
