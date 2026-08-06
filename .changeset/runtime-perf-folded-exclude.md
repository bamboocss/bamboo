---
'@bamboocss/dev': patch
---

Keep the render-parity test artifact out of the sandbox's extraction glob.

`sandbox/runtime-perf/__tests__/render-parity.test.ts` writes `tree.folded.tsx` beside its source — deliberately, so the
relative imports resolve identically — and deletes it when the file finishes. Any Bamboo context built while it exists
globs it, and the glob reads every matched path with no guard. So a context created in one test file and the cleanup
running in another race each other, and the loser fails with `ENOENT` pointing at a file no one was asking about:

```
FAIL sandbox/runtime-perf/__tests__/bundle-size.test.ts
Error: [bamboocss] ENOENT: no such file or directory, open '…/src/parity/tree.folded.tsx'
```

Roughly one full-suite run in five. Excluding `**/*.folded.tsx` closes it: the folded file already carries literal class
strings, so nothing needs to extract from it — its classes come from the `tree.tsx` it was folded from, which stays
included.

Test-only; no user-facing behaviour changes.
