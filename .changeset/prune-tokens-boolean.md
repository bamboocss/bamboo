---
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/config': minor
'@bamboocss/node': minor
'@bamboocss/generator': minor
---

`prune.tokens` takes a boolean again, and token accounting is the default.

It was `'off' | 'reachable' | 'accounted'`, which conflated two separate questions: how hard to try to bound the keep
set, and what to say when that fails. `'reachable'` answered one cheap question — _does any javascript reach for a
token_ — and threw away everything else it had read, so a single `token()` call anywhere kept all 468 declarations of
the default preset. `'accounted'` did the work properly but was framed as an assertion, so it reported by default and
had to be asked for. The combination nobody could ask for was the useful one: do the work, and stay quiet.

- `prune.tokens: boolean`, default `true`. `false` is the old `'off'`; `true` accounts for each token path individually,
  which is what `'accounted'` did.
- `prune.unresolvedPath` now defaults to `'off'` rather than `'warn'`. Pruning is an inference the build makes unasked,
  not a claim you told it to check, so it is silent unless you ask. `'warn'` names what is holding the keep set open;
  `'error'` still asserts the fallback never ships.
- A config still passing a string fails with the edit to make. `'off'` is the dangerous direction — it asked for no
  pruning and would otherwise have silently got the opposite.

Two things to check when upgrading:

- **A token read from outside `include` is no longer covered by accident.** The old default kept every declaration the
  moment any javascript reached for a token, so a project with one `token()` call in it protected its scripts, configs
  and sibling workspace packages without meaning to — and a project with none did not. The accounting sees only what
  `include` covers, so name those categories with `prune: { keepTokens: ['colors.*'] }`. This is the trade the change
  makes deliberately: consistent pruning with a declared bound, rather than protection by coincidence.
- **`prune: { unresolvedPath: 'error' }` written without `tokens` now fails builds it used to ignore.** It was inert
  unless you also asked for `'accounted'`; it is read directly now, which is what the setting always claimed to mean.

A file that can neither name the artifact nor decline on its own is now skipped before the identifier walk, so the
accounting costs nothing where there is nothing to account for. It has to be wider than the word `token`: a configured
`importMap.tokens` need not contain it, an identifier may be written with unicode escapes, and `require()`/`import()`
decline on a specifier the build cannot read whatever it names. `sandbox/vite-ts` has six files under `include` and not
one of them mentions a token: `cssgen` there measures 22.0 ms under the old default, 31.5 ms under ungated accounting,
and 22.9 ms now.

Measured across the 16 sandboxes: 15 emit a byte-identical stylesheet, none keeps more than it did, and none reports
anything. `preact-ts` goes from 448 token declarations to 37, and 20,627 B to 6,395 B. This repository's documentation
site goes from 500 declarations to 146, 86,644 B to 73,773 B raw and 12,829 B to 10,903 B brotli, and its `cssgen` from
65.0 ms to 79.1 ms.
